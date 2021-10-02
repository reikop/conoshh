import MessageWorker from "../MessageWorker.js";
import {Player, RepeatMode} from "discord-music-player";
import Discord from "discord.js";

import _ from "lodash"

/**
 * https://github.com/SushiBtw/discord-music-player
 * https://discord-music-player.js.org/
 */
export default class MusicPlayer extends MessageWorker {

    constructor(client) {
        super();
        this._player = new Player(client);
        this._client = client;
        this.getMusicServerLists()

        this._player.on("songChanged", this.playerSongChanged.bind(this));
        this._player.on("queueEnd", this.playerEventHandler.bind(this));
        this._player.on('channelEmpty',  (queue) => this.playerEventHandler(queue));
        this._player.on("error", (error, queue) => {
            console.error(error);
        });
    }
    _client;
    _player;
    _servers = [];
    get servers(){
        return this._servers;
    }
    get player() {
        return this._player;
    }

    playerSongChanged(que){
        const server = _.find(this.servers, {guildId: que.guild.id});
        if(server){
            const id = server.id
            const channel = this._client.channels.cache.get(id);
            this.updateSong(channel);
        }
    }
    async playerEventHandler(que) {
        const server = _.find(this.servers, {guildId: que.guild.id});
        if (server) {
            const id = server.id
            const channel = this._client.channels.cache.get(id);
            await this.clearChannel(channel);
            await this.updateSong(channel);
        }
    }

    async updateError(message, reason){
        // await this.updateSong(message.channel);
        await message.channel.send(reason).catch(()=>{})
    }
    async updateSong(channel) {
        try{
            const {songs} = this.player.getQueue(channel.guild.id);
            if(songs.length > 0){
                const song = songs[0];
                let repeatModeText = "";
                if(song.queue && song.queue.repeatMode){
                    repeatModeText = "[반복중] ";
                }
                const currentSong = new Discord.MessageEmbed()
                    .setColor("LUMINOUS_VIVID_PINK")
                    .setTitle(repeatModeText + `[${song.duration}] - ${song.name}`)
                    .setImage(song.thumbnail)
                    .setURL(song.url);
                const que = songs.map((song, i) => `${i+1}. ${song.name} [${song.duration}]`);
                await this.clearChannel(channel);
                await channel.send(que.join("\n"));
                await channel.send({
                    embeds: [currentSong]
                });
            }else if(songs.length === 0){
                const order = [
                    {key: '나가', value: '바로 종료'},
                    {key: '다음', value: '다음 곡'},
                    {key: '반복', value: '한 곡 반복듣기'},
                    {key: '그만', value: '반복듣기 끄기'}
                ];
                await channel.send({
                    embeds: [
                        new Discord.MessageEmbed()
                            // .setAuthor(`made By 동매 (aka. reikop)`,
                            //     null,
                            //     `https://reikop.com`)
                            .setTitle(`노래하는 코노슝 v0.2 명령어`)
                            .setColor("DARK_BLUE")
                            .setDescription("노래 제목 혹은 유튜브 URL을 입력하시면 자동으로 노래를 검색합니다.")
                            // .setThumbnail("https://imgfiles-cdn.plaync.com/file/contents/download/20210923131701-aKxbqDhdNhkVeKMG09160-v4")
                            .addField('명령어', order.map(o => `${o.key} : ${o.value}`).join("\n"), true)
                            .setTimestamp()
                    ]
                });
            }
        }catch (e){
            const order = [
                {key: '나가', value: '바로 종료'},
                {key: '다음', value: '다음 곡'},
                {key: '반복', value: '한 곡 반복듣기'},
                {key: '그만', value: '반복듣기 끄기'}
            ];
            await channel.send({
                embeds: [
                    new Discord.MessageEmbed()
                        // .setAuthor(`made By 동매 (aka. reikop)`,
                        //     null,
                        //     `https:/제/reikop.com`)
                        .setTitle(`노래하는 코노슝 v0.2 명령어`)
                        .setColor("DARK_BLUE")
                        .setDescription("노래 제목 혹은 유튜브 URL을 입력하시면 자동으로 노래를 검색합니다.")
                        // .setThumbnail("https://imgfiles-cdn.plaync.com/file/contents/download/20210923131701-aKxbqDhdNhkVeKMG09160-v4")
                        .addField('명령어', order.map(o => `${o.key} : ${o.value}`).join("\n"), true)
                        .setTimestamp()
                ]
            });
        }
    }

    async clearChannel(channel) {
        await channel.bulkDelete(10);
        // messages.forEach(message => message.delete());
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
                    const permis = ['SEND_MESSAGES', 'MANAGE_MESSAGES', 'CONNECT', 'SPEAK', 'DEAFEN_MEMBERS'];
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
                message.channel.sendTyping();
            }
            const args = message.content.slice("!").trim().split(/ +/g);
            const command = args.shift();
            let guildQueue = this.player.getQueue(message.guild.id);
            if (command === '다음') {
                if (guildQueue) {
                    guildQueue.skip();
                    message.delete();
                }
            } else if (command === '반복') {
                guildQueue.setRepeatMode(RepeatMode.SONG);
                message.delete();
                await this.clearChannel(message.channel);
                await this.updateSong(message.channel);
            } else if (command === '그만') {
                guildQueue.setRepeatMode(RepeatMode.DISABLED);
                message.delete();
                await this.clearChannel(message.channel);
                await this.updateSong(message.channel);
            } else if (command === '나가') {
                if (guildQueue) {
                    guildQueue.stop();
                }
                await this.clearChannel(message.channel);
                await this.updateSong(message.channel);
            } else if (!message.author.bot) {
                let queue = this.player.createQueue(message.guild.id);
                if(message.member.voice.channel){
                    queue.join(message.member.voice.channel).then(async c => {
                        message.guild.me.voice.setDeaf(true).catch(()=>{});
                        queue.play(message.content).then(song => {
                            this.updateSong(message.channel, song)
                        }).catch(_ => {
                            if (!guildQueue) {
                                queue.stop();
                            }
                            this.updateError(message, "오류가 발생했습니다.");
                        });
                    }).catch(e => {
                        console.error(e);
                        this.updateError(message, "오류가 발생했습니다.");
                    });
                }else{
                    this.clearChannel(message.channel)
                    this.updateError(message, "`접속한 음성채널을 찾을 수 없습니다.`");
                }

                message.delete();
            }
        } catch (e) {
            console.error(e)
        }
    }
}