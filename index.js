require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { DisTube } = require('distube');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { YouTubePlugin } = require('@distube/youtube');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { SoundCloudPlugin } = require('@distube/soundcloud');

client.distube = new DisTube(client, {
    plugins: [
        new YtDlpPlugin(),
        new SoundCloudPlugin()
    ],
    emitNewSongOnly: true
});

client.on('ready', () => console.log(`${client.user.tag} يعمل الآن!`));

// دالة لتحديث حالة الروم الصوتي
async function setVoiceStatus(queue, text) {
    if (queue && queue.voiceChannel) {
        try {
            // تحديث حالة الروم (يتطلب صلاحية Manage Channels أو Set Voice Status)
            await queue.voiceChannel.setStatus(text ? text.substring(0, 100) : null);
        } catch (e) {
            console.error("خطأ في تحديث حالة الروم:", e);
        }
    }
}

client.distube.on('playSong', async (queue, song) => {
    await setVoiceStatus(queue, `▶️ ${song.name}`);
    queue.textChannel.send(`🎶 جاري تشغيل: **${song.name}**`);
});

client.distube.on('finish', (queue) => setVoiceStatus(queue, null));
client.distube.on('error', (channel, error) => {
    console.error(error);
    channel.send("❌ حدث خطأ أثناء التشغيل، يوتيوب قد يكون حظر الطلب.");
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!p')) return;
    const query = message.content.slice(3).trim();
    if (!query) return;
    
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply("ادخل روم صوتي أولاً!");

    client.distube.play(voiceChannel, query, {
        textChannel: message.channel,
        member: message.member
    });
});

client.login(process.env.TOKEN);
