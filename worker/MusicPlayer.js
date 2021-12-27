import MessageWorker from "../MessageWorker.js";
import Discord from "discord.js";
import _ from "lodash"
import {Manager} from "erela.js";

const LAVALINK_HOST = process.env.LAVALINK_HOST;
const LAVALINK_PORT = process.env.LAVALINK_PORT;
const LAVALINK_PASSWD = process.env.LAVALINK_PASSWD;


/**
 * https://github.com/SushiBtw/discord-music-player
 * https://discord-music-player.js.org/
 */
export default class MusicPlayer extends MessageWorker {
    constructor(client) {
        super();
        client.manager = new Manager({
            nodes: [
                {
                    host: LAVALINK_HOST,
                    port: parseInt(LAVALINK_PORT),
                    password: LAVALINK_PASSWD,
                },
            ],
            send(id, payload) {
                const guild = client.guilds.cache.get(id);
                if (guild) guild.shard.send(payload);
            },
        })

            .on("playerMove", (player, currentChannel, newChannel)=> {
                player.setVoiceChannel(newChannel);
            })
            .on("trackStuck", (player) => {
                this.updateSong(player);
            }).on("trackError", (player) => {
                this.updateSong(player);
            })
            .on("trackStart", (player) => {
                this.updateSong(player);
            })
            .on("queueEnd", (player) => {
                this.updateSong(player);
                player.destroy();
            });

        this._client = client;
        this.getMusicServerLists().then();
        client.manager.init(client.user.id);
        client.on("raw", (d) => client.manager.updateVoiceState(d));
    }
    _client;
    _servers = [];
    get servers(){
        return this._servers;
    }

    async updateError(message, reason){
        await message.channel.send(reason).catch(()=>{})
    }

    async updateBotMessage(channel, content){
        channel.messages.fetch({ limit: 100 }).then(messages => {
            const msgs = messages.filter(m => m.author.bot);
            if(msgs.size > 0){
                for (let i = 0; i < msgs.size; i++) {
                    const isLast = i+1 === msgs.size;
                    if(!isLast){
                        channel.bulkDelete(messages, true).catch(()=>{})
                    }else{
                        msgs.last().edit(content).catch(()=>{})
                    }
                }
            }else{
                channel.send(content).catch(()=>{})
            }
        });

    }


    getPlayer(guildId, voiceChannelId, textChannelId){
        const manager = this._client.manager;
        if(!manager.players.has(guildId) && voiceChannelId && textChannelId){
            this._client.manager.create({
                guild: guildId,
                selfDeafen: true,
                volume: 50,
                voiceChannel: voiceChannelId,
                textChannel: textChannelId,
            })
        }
        return manager.players.get(guildId);
    }

    async updateSong(player) {
        const queue = player.queue;
        const track = queue.current;
        const channel = this._client.channels.cache.get(player.textChannel);
        if(track){
            const tracks = [queue.current];
            for (let i = 0; i < queue.size; i++) {
                tracks.push(queue[i]);
            }
            const repeatModeText = player.queueRepeat ? "🔁 " : "💿 ";
            const que = tracks.map((song, i) => `${i+1}. ${song.title} \`${this.parseDuration(song.duration)}\``);
            const currentSong = new Discord.MessageEmbed()
                .setColor("LUMINOUS_VIVID_PINK")
                .setTitle(repeatModeText + `[${this.parseDuration(track.duration)}] ${track.title}`)
                // .setImage(track.thumbnail)
                .setImage(`https://img.youtube.com/vi/${track.identifier}/0.jpg`)
                .setTimestamp(new Date())
                .setFooter(`${track.requester.username}님의 선곡`)
                .setURL(track.uri);

            if(que.length > 1){
                currentSong.addField("재생 목록", que.join("\n"));
            }
            await this.updateBotMessage(channel, {embeds: [currentSong]});
        }else if(queue.size === 0){
            await this.sendDefaultMsg(channel)
        }
    }

    async sendDefaultMsg(channel){
        const order = [
            {key: '나가', value: '바로 종료'},
            {key: '다음', value: '다음 곡'},
            {key: '반복', value: '한 곡 반복듣기'},
            {key: '그만', value: '반복듣기 끄기'},
            {key: '정리', value: '채널 모든 메시지 삭제'}
        ];
        await this.updateBotMessage(channel, {
            embeds: [
                new Discord.MessageEmbed()
                    // .setAuthor(`made By 동매 (aka. reikop)`,
                    //     null,
                    //     `https://reikop.com`)
                    .setTitle(`노래하는 코노슝 v0.4 명령어`)
                    .setColor("DARK_BLUE")
                    .setDescription("노래 제목 혹은 유튜브 URL을 입력하시면 자동으로 노래를 검색합니다.")
                    // .setThumbnail("https://imgfiles-cdn.plaync.com/file/contents/download/20210923131701-aKxbqDhdNhkVeKMG09160-v4")
                    .addField('명령어', order.map(o => `${o.key} : ${o.value}`).join("\n"), true)
                    .setTimestamp()
            ]
        })
    }

    async clearAllChannel(channel) {
        await channel.messages.fetch({ limit: 100 }).then(messages => {
            channel.bulkDelete(messages, true).then().catch();
        });


        // await channel.bulkDelete(10).catch()
    //     messages.forEach(message => message.delete());
    }

    async addMusicServer({guildId, id}){
        const params = new URLSearchParams();
        params.append('id', id);
        await this.api.patch("https://reikop.com:8081/api/music/" + guildId, params);
        await this.getMusicServerLists();
    }

    async getMusicServerLists(){
        const {data} =  await this.api.get("https://reikop.com:8081/api/music");
        this._servers =data;
    }

    async receiveMessage(message) {
        try {
            if (message.author.id === '366297167247310860') {
                if (message.content === "코노슝 설치") {
                    const permis = ['SEND_MESSAGES', 'MANAGE_MESSAGES', 'CONNECT', 'SPEAK'];
                    const permit = !permis.some(p => !message.guild.me.permissions.has(p));
                    if(permit){
                        await this.addMusicServer(message.channel);
                        await message.channel.send({
                            embeds: [
                                new Discord.MessageEmbed()
                                    .setColor("GOLD")
                                    .setTitle("코노슝 설치가 완료 되었습니다.")
                                    .setDescription("개발자 전용 명령어 입니다.")
                            ]
                        });
                    }else{
                        await message.channel.send('필요한 `권한`이 없습니다. 봇을 다시 등록하거나 관리자에게 문의해주세요.');
                    }
                    await message.delete();
                    return;
                }
            }
            const server = _.find(this.servers, {guildId: message.guild.id, id: message.channel.id});
            if (!server) {
                return;
            }
            if (!message.author.bot){
                message.channel.sendTyping().then().catch();
            }
            const args = message.content.slice("!").trim().split(/ +/g);
            const command = args.shift();
            let player = this.getPlayer(message.guild.id);
            if (command === '다음') {
                if (player) {
                    player.stop();
                    message.delete();
                }
                setTimeout(() => {
                    this.updateSong(player);
                }, 1000)
            } else if (command === '정리') {
                await this.clearAllChannel(message.channel);
                await this.updateSong(player);
            } else if (command === '반복') {
                player.setQueueRepeat(true)
                message.delete();
                await this.updateSong(player);
            } else if (command === '그만') {
                player.setQueueRepeat(false)
                message.delete();
                await this.updateSong(player);
            } else if (command === '나가') {
                if (player) {
                    player.destroy();
                }
                message.delete();
                await this.sendDefaultMsg(message.channel);
            } else if (!message.author.bot) {
                const res = await this._client.manager.search(
                    message.content,
                    message.author
                );
                const player = this.getPlayer(message.guild.id, message.member.voice.channel.id, message.channel.id);
                if(message.member.voice.channel){
                    player.connect();
                    player.queue.add(res.tracks[0]);

                    if (!player.playing && !player.paused && !player.queue.size){
                        player.play();
                    }

                    if (
                        !player.playing &&
                        !player.paused &&
                        player.queue.totalSize === res.tracks.length
                    ){
                        player.play();
                    }
                    await this.updateSong(player);
                }else{
                    await this.updateError(message, "`접속한 음성채널을 찾을 수 없습니다.`");
                }
                message.delete();
            }
        } catch (e) { }
    }

     parseDuration(SECONDS){
        return new Date(SECONDS).toISOString().substr(11, 8)
    }
}