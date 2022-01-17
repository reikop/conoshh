import Discord, {Intents} from "discord.js";
import MessageRouter from "./MessageRouter.js";
import MusicPlayer from "./worker/MusicPlayer.js";
const DISCORD_KEY = process.env.DISCORD_TOKEN;
const router = new MessageRouter();
const client = new Discord.Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES]
});
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

client.on('message', async msg => router.receiveMessage(msg));
client.login(DISCORD_KEY);


client.once("ready", () => {
    router.registWorker("*", new MusicPlayer(client));
});

//
// process.on("uncaughtException", error => {
//     console.info("uncaughtException", error.message)
// })
