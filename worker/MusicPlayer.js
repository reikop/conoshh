import MessageWorker from "../MessageWorker.js";
import Discord, {EmbedBuilder} from "discord.js";
import _ from "lodash"
import {Manager} from "erela.js";
import axios from "axios";

const HOST = "https://reikop.io";
const LAVALINK_HOST = process.env.LAVALINK_HOST;
const LAVALINK_PORT = process.env.LAVALINK_PORT;
const LAVALINK_PASSWD = process.env.LAVALINK_PASSWD;
const BOT_SEQ = process.env.BOT_SEQ || "1";

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
                if(newChannel){
                    player.setVoiceChannel(newChannel);
                    setTimeout(() => {
                        player.pause(false);
                    }, 500)
                }else{
                    player.queue.current = null;
                    player.queue.clear();
                    player.stop();
                    player.destroy();
                    const channel = this._client.channels.cache.get(player.textChannel);
                    this.updateSong(player, channel);
                }
            })
            .on("trackStuck", (player) => {
                this.updateSong(player, this._client.channels.cache.get(player.textChannel));
            }).on("trackEnd", (player) => {
                this.updateSong(player, this._client.channels.cache.get(player.textChannel));
            }).on("trackError", (player) => {
                this.updateSong(player, this._client.channels.cache.get(player.textChannel));
            })
            .on("trackStart", (player) => {
                this.updateSong(player, this._client.channels.cache.get(player.textChannel));
            })
            .on("queueEnd", (player) => {
                this.updateSong(player, this._client.channels.cache.get(player.textChannel));
                player.destroy();
            });

        this._client = client;
        this.getMusicServerLists().then(() => {
            client.manager.init(client.user.id);
            client.on("raw", (d) => client.manager.updateVoiceState(d));
        }).catch(e => console.error(e));

    }

    /**
     * @type{import('discord.js').Client}
     * @private
     */
    _client;
    _servers = [];
    get servers(){
        return this._servers;
    }

    async updateError(message, reason){
        await message.channel.send(reason).catch((e)=>{console.info(e)})
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
                volume: 30,
                voiceChannel: voiceChannelId,
                textChannel: textChannelId,
            })
        }
        return manager.players.get(guildId);
    }

    /**
     *
     * @param player{import('erela.js').Player}
     * @param channel
     * @return {Promise<void>}
     */
    async updateSong(player, channel) {
        // const channel = this._client.channels.cache.get(player.textChannel);
        if(player?.queue?.current){
            const queue = player.queue;
            const track = queue.current;
            const tracks = [queue.current];
            for (let i = 0; i < queue.size; i++) {
                tracks.push(queue[i]);
            }
            const repeatModeText = player.queueRepeat ? "🔁 " : "💿 ";
            const que = tracks.map((song, i) => `${i+1}. ${song.title} \`${this.parseDuration(song)}\``);
            const currentSong = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 16777214) + 1)
                .setTitle(repeatModeText + `[${this.parseDuration(track)}] ${track.title}`)
                // .setImage(track.thumbnail)
                .setImage(`https://img.youtube.com/vi/${track.identifier}/0.jpg`)
                .setAuthor({
                    name: track.author,
                })
                .setTimestamp(new Date())
                    .setFooter({
                        text: `${track.requester.username}님의 선곡`
                    })
                .setURL(track.uri);

            if(que.length > 1){
                currentSong.addFields({name: "재생 목록", value: que.join("\n")});
            }
            await this.updateBotMessage(channel, {embeds: [currentSong]});
        }else{
            await this.sendDefaultMsg(channel)
        }
    }

    /**
     *
     * @param message{import('discord.js').Message}
     * @return {Promise<void>}
     */
    async messageDelete(message){
        const server = _.find(this.servers, {guildId: message.guild.id, id: message.channel.id, bot_id:BOT_SEQ});
        if(server){
            try{
                if(message.deletable){
                    await message.delete();
                }
            }catch (e) {
                console.error("message DELETE ERROR", e);
            }

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
                new EmbedBuilder()
                    // .setAuthor(`made By 동매 (aka. reikop)`,
                    //     null,
                    //     `https://reikop.com`)
                    .setTitle(`노래하는 코노슝#${BOT_SEQ} v0.5 명령어`)
                    .setColor(0x00008b)
                    .setDescription("노래 제목 혹은 유튜브 URL을 입력하시면 자동으로 노래를 검색합니다.")
                    // .setThumbnail("https://imgfiles-cdn.plaync.com/file/contents/download/20210923131701-aKxbqDhdNhkVeKMG09160-v4")
                    .addFields({name:'명령어', value: order.map(o => `${o.key} : ${o.value}`).join("\n"), inline: true})
                    .setTimestamp()
            ]
        })
    }
    // 3155968
    async clearAllChannel(channel) {
        await channel.messages.fetch({ limit: 100 }).then(async messages => {
            await channel.bulkDelete(messages, true);
        });
    }

    async addMusicServer({guildId, id}){
        const {data} = await axios.patchForm(`${HOST}/api/music/${guildId}/${BOT_SEQ}/${id}`).catch(e => console.error(e))
        await this.getMusicServerLists();
    }

    async removeMusicServer({guildId, id}){
        await axios.delete(`${HOST}/api/music/${guildId}/${id}/${BOT_SEQ}`);
        await this.getMusicServerLists();
    }

    async getMusicServerLists(){
        const {data} =  await axios.get(`${HOST}/api/music`);
        this._servers = data;
    }
    /**
     *
     * @param interaction{ ChatInputCommandInteraction<CacheType> | MessageContextMenuCommandInteraction<CacheType> | UserContextMenuCommandInteraction<CacheType> | SelectMenuInteraction<CacheType> | ButtonInteraction<CacheType> | AutocompleteInteraction<CacheType> | ModalSubmitInteraction<CacheType>}
     */
    async receiveInteraction(interaction) {
        this.receiveMessage(interaction.message);
    }
    /**
     *
     * @param message{import('discord.js').MessageChannel}
     * @return {Promise<void>}
     */
    async receiveMessage(message) {
        try {

            if (message.author.id === '366297167247310860') {
                await this.getMusicServerLists();
                const server = _.find(this.servers, {guildId: message.guild.id, id: message.channel.id, bot_id:BOT_SEQ});
                const reg = /코노슝 설치\s?(\d)?/;
                const delReg = /코노슝 삭제\s?(\d)?/;
                if (message.content.match(reg)){
                    if(server == null){
                        // const permis = ['SEND_MESSAGES', 'MANAGE_MESSAGES', 'CONNECT', 'SPEAK'];
                        // const permit = !permis.some(p => !message.guild.me.permissions.has(p));
                        // if(permit){
                            const seq = message.content.match(reg)[1] || "1";
                            if(seq === BOT_SEQ){
                                await this.addMusicServer(message.channel);
                                await message.channel.send({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setColor(0xFFD700)
                                            .setTitle(`코노슝#${BOT_SEQ} 설치가 완료 되었습니다.`)
                                            .setDescription(message.author.username+" 개발자님 전용 명령어 입니다.")
                                    ]
                                });
                            }
                        // }else{
                        //     await message.channel.send('필요한 `권한`이 없습니다. 봇을 다시 등록하거나 관리자에게 문의해주세요.');
                        // }
                    }else{
                        await message.channel.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0xFFD700)
                                    .setTitle("코노슝 설치가 이미 되었습니다.\n삭제 하려면 명령어를 입력해 주세요")
                                    .setDescription("개발자 전용 명령어 입니다.")
                            ]
                        });
                    }

                    return;
                }else if (message.content.match(delReg)) {
                    const seq = message.content.match(delReg)[1] || "1";
                    if(seq === BOT_SEQ){
                        await this.removeMusicServer(message.channel);
                        await message.channel.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0xFFD700)
                                    .setTitle("코노슝 삭제가 완료 되었습니다.")
                            ]
                        });
                    }
                }
            }
            const server = _.find(this.servers, {guildId: message.guild.id, id: message.channel.id, bot_id: BOT_SEQ});
            if (!server) {
                return;
            }

            if (!message.author.bot){
                message.channel.sendTyping().then().catch();
            }

            const args = message.content.trim().split(/ +/g);
            const command = args.shift();
            let player = this.getPlayer(message.guild.id);
            if (command === '다음') {
                if (player) {
                    player.stop();
                    await this.messageDelete(message)
                }
                setTimeout(() => {
                    this.updateSong(player, message.channel);
                }, 1000)
            } else if (command === '정리') {
                await this.clearAllChannel(message.channel);
                setTimeout(() => {
                    this.updateSong(player, message.channel);
                }, 1000)
            } else if (command === '반복') {
                player.setQueueRepeat(true)
                await this.messageDelete(message)
                await this.updateSong(player, message.channel);
            } else if (command === '그만') {
                player.setQueueRepeat(false)
                await this.messageDelete(message)
                await this.updateSong(player, message.channel);
            } else if (command === '나가') {
                if (player) {
                    player.destroy();
                }
                await this.messageDelete(message)
                await this.sendDefaultMsg(message.channel);
            } else if (!message.author.bot) {
                if(message.member.voice.channel){
                    const res = await this._client.manager.search(
                        message.content,
                        message.author
                    );
                    const player = this.getPlayer(message.guild.id, message.member.voice.channel.id, message.channel.id);
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
                    await this.updateSong(player, message.channel);
                }else{
                    await this.updateError(message, "`접속한 음성채널을 찾을 수 없습니다.`");
                }

                await this.messageDelete(message)
            }
        } catch (e) {
            console.trace(e);
        }
    }

     parseDuration(song){
        if(song.isStream){
            return "LIVE"
        }else{
            return new Date(song.duration).toISOString().substr(11, 8)
        }
    }
}