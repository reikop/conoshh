import Discord, {Intents} from "discord.js";
import MessageRouter from "./MessageRouter.js";
import MusicPlayer from "./worker/MusicPlayer.js";
const DISCORD_KEY = process.env.DISCORD_TOKEN;
const router = new MessageRouter();
const client = new Discord.Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES]
});
router.registWorker("*", new MusicPlayer(client));
client.on('message', async msg => router.receiveMessage(msg));
client.login(DISCORD_KEY);
process.on("uncaughtException", error => {
    console.info("uncaughtException", error.message)
})
