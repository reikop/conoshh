import parser from "args-parser";
import Discord, {Intents} from "discord.js";
// import Server from "./worker/Server.js";
// import Find from "./worker/Find.js";
// import Trim from "./worker/Trim.js";
import MessageRouter from "./MessageRouter.js";
import MusicPlayer from "./worker/MusicPlayer.js";

const client = new Discord.Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES]
});
const args = parser(process.argv);
const DISCORD_KEY = args.key;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


const router = new MessageRouter();
// router.registWorker("!서버", new Server());
// router.registWorker("!정리", new Trim(client));
// router.registWorker(["!누구", "!검색"], new Find());
router.registWorker("*", new MusicPlayer(client));

client.on('message', async msg => router.receiveMessage(msg));
console.info("DISCORD_KEY", DISCORD_KEY)
client.login(DISCORD_KEY);

process.on("uncaughtException", error => {
    console.info("uncaughtException", error.message)
})
