import {Client, GatewayIntentBits, Partials} from "discord.js";
import MessageRouter from "./MessageRouter.js";
import MusicPlayer from "./worker/MusicPlayer.js";
const DISCORD_KEY = process.env.DISCORD_TOKEN;
const router = new MessageRouter();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
client.on('messageCreate', async msg => router.receiveMessage(msg));
client.login(DISCORD_KEY);
client.once("ready", () => {
    router.registWorker("*", new MusicPlayer(client));
});
//
// process.on("uncaughtException", error => {
//     console.trace("uncaughtException", error.message)
// })
