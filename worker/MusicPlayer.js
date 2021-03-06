import MessageWorker from "../MessageWorker.js";
import Discord from "discord.js";
import _ from "lodash"
import {Manager} from "erela.js";

const HOST = "https://reikop.com:8081";
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
                    this.updateSong(player);
                }
            })
            .on("trackStuck", (player) => {
                this.updateSong(player);
            }).on("trackEnd", (player) => {
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

    async updateSong(player) {
        const queue = player.queue;
        const track = queue.current;
        const channel = this._client.channels.cache.get(player.textChannel);
        if(track){
            const tracks = [queue.current];
            for (let i = 0; i < queue.size; i++) {
                tracks.push(queue[i]);
            }
            const repeatModeText = player.queueRepeat ? "???? " : "???? ";
            const que = tracks.map((song, i) => `${i+1}. ${song.title} \`${this.parseDuration(song)}\``);
            const currentSong = new Discord.MessageEmbed()
                .setColor("RANDOM")
                .setTitle(repeatModeText + `[${this.parseDuration(track)}] ${track.title}`)
                // .setImage(track.thumbnail)
                .setImage(`https://img.youtube.com/vi/${track.identifier}/0.jpg`)
                .setAuthor(track.author)
                .setTimestamp(new Date())
                .setFooter(`${track.requester.username}?????? ??????`)
                .setURL(track.uri);

            if(que.length > 1){
                currentSong.addField("?????? ??????", que.join("\n"));
            }
            await this.updateBotMessage(channel, {embeds: [currentSong]});
        }else if(queue.size === 0){
            await this.sendDefaultMsg(channel)
        }
    }
    
    async messageDelete(message){
        const server = _.find(this.servers, {guildId: message.guild.id, id: message.channel.id, bot_id:BOT_SEQ});
        if(server){
            try{
                await message.delete();
            }catch (e) {
                console.error("message DELETE ERROR", e);
            }

        }
    }
    
    
    async sendDefaultMsg(channel){
        const order = [
            {key: '??????', value: '?????? ??????'},
            {key: '??????', value: '?????? ???'},
            {key: '??????', value: '??? ??? ????????????'},
            {key: '??????', value: '???????????? ??????'},
            {key: '??????', value: '?????? ?????? ????????? ??????'}
        ];
        await this.updateBotMessage(channel, {
            embeds: [
                new Discord.MessageEmbed()
                    // .setAuthor(`made By ?????? (aka. reikop)`,
                    //     null,
                    //     `https://reikop.com`)
                    .setTitle(`???????????? ?????????#${BOT_SEQ} v0.4 ?????????`)
                    .setColor("DARK_BLUE")
                    .setDescription("?????? ?????? ?????? ????????? URL??? ??????????????? ???????????? ????????? ???????????????.")
                    // .setThumbnail("https://imgfiles-cdn.plaync.com/file/contents/download/20210923131701-aKxbqDhdNhkVeKMG09160-v4")
                    .addField('?????????', order.map(o => `${o.key} : ${o.value}`).join("\n"), true)
                    .setTimestamp()
            ]
        })
    }

    async clearAllChannel(channel) {
        await channel.messages.fetch({ limit: 100 }).then(async messages => {
            await channel.bulkDelete(messages, true);
        });
    }

    async addMusicServer({guildId, id}){
        console.info(guildId, id, BOT_SEQ)
        const params = new URLSearchParams();
        params.append('id', id);
        await this.api.patch(`${HOST}/api/music/${guildId}/${BOT_SEQ}`, params);
        await this.getMusicServerLists();
    }

    async removeMusicServer({guildId, id}){
        await this.api.delete(`${HOST}/api/music/${guildId}/${id}/${BOT_SEQ}`);
        await this.getMusicServerLists();
    }

    async getMusicServerLists(){
        const {data} =  await this.api.get(`${HOST}/api/music`);
        this._servers = data;
    }

    async receiveMessage(message) {
        try {

            if (message.author.id === '366297167247310860') {
                await this.getMusicServerLists();
                const server = _.find(this.servers, {guildId: message.guild.id, id: message.channel.id, bot_id:BOT_SEQ});
                const reg = /????????? ??????\s?(\d)?/;
                const delReg = /????????? ??????\s?(\d)?/;
                if (message.content.match(reg)){
                    if(server == null){
                        const permis = ['SEND_MESSAGES', 'MANAGE_MESSAGES', 'CONNECT', 'SPEAK'];
                        const permit = !permis.some(p => !message.guild.me.permissions.has(p));
                        if(permit){
                            const seq = message.content.match(reg)[1] || "1";
                            if(seq === BOT_SEQ){
                                await this.addMusicServer(message.channel);
                                await message.channel.send({
                                    embeds: [
                                        new Discord.MessageEmbed()
                                            .setColor("GOLD")
                                            .setTitle(`?????????#${BOT_SEQ} ????????? ?????? ???????????????.`)
                                            .setDescription(message.author.username+" ???????????? ?????? ????????? ?????????.")
                                    ]
                                });
                            }
                        }else{
                            await message.channel.send('????????? `??????`??? ????????????. ?????? ?????? ??????????????? ??????????????? ??????????????????.');
                        }
                    }else{
                        await message.channel.send({
                            embeds: [
                                new Discord.MessageEmbed()
                                    .setColor("GOLD")
                                    .setTitle("????????? ????????? ?????? ???????????????.\n?????? ????????? ???????????? ????????? ?????????")
                                    .setDescription("????????? ?????? ????????? ?????????.")
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
                                new Discord.MessageEmbed()
                                    .setColor("GOLD")
                                    .setTitle("????????? ????????? ?????? ???????????????.")
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
            const args = message.content.slice("!").trim().split(/ +/g);
            const command = args.shift();
            let player = this.getPlayer(message.guild.id);
            if (command === '??????') {
                if (player) {
                    player.stop();
                    await this.messageDelete(message)
                }
                setTimeout(() => {
                    this.updateSong(player);
                }, 1000)
            } else if (command === '??????') {
                await this.clearAllChannel(message.channel);
                setTimeout(() => {
                    this.updateSong(player);
                }, 1000)
            } else if (command === '??????') {
                player.setQueueRepeat(true)
                await this.messageDelete(message)
                await this.updateSong(player);
            } else if (command === '??????') {
                player.setQueueRepeat(false)
                await this.messageDelete(message)
                await this.updateSong(player);
            } else if (command === '??????') {
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
                    await this.updateSong(player);
                }else{
                    await this.updateError(message, "`????????? ??????????????? ?????? ??? ????????????.`");
                }

                await this.messageDelete(message)
            }
        } catch (e) {
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