require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const https = require('https'); // مكتبة فك اللينكات المختصرة

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.distube = new DisTube(client, {
    emitNewSongOnly: true,
    plugins: [
        new SpotifyPlugin(),
        new SoundCloudPlugin()
    ]
});

client.once('ready', () => {
    console.log(`✅ الموزع جاهز! سجلت الدخول باسم ${client.user.tag}`);
    client.user.setPresence({
        activities: [{
            name: 'customstatus',
            type: 4,
            state: '🤖 I serve TOP server | 💻 Designed by: Omar'
        }],
        status: 'online'
    });
});

const createControllerRow = () => {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pause_resume').setLabel('⏸️ تشغيل/إيقاف').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('skip').setLabel('⏭️ تخطي').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('voldown').setLabel('📉 توطية').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('volup').setLabel('📈 تعلية').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('stop').setLabel('🛑 إيقاف').setStyle(ButtonStyle.Danger)
    );
};

// وظيفة ذكية لفك لينكات أنغامي المختصرة وجلب اسم الأغنية الحقيقي
function resolveAnghami(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            const redirectUrl = res.headers.location || '';
            if (redirectUrl.includes('/song/')) {
                let cleanName = redirectUrl.split('/song/')[1].split('?')[0].replace(/[-_]/g, ' ');
                resolve(decodeURIComponent(cleanName));
            } else {
                resolve(null);
            }
        }).on('error', () => resolve(null));
    });
}

client.on('messageCreate', async (message) => {
    const prefix = process.env.PREFIX || '!';
    if (message.author.bot || !message.guild || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();
    let query = args.join(' ');

    if (command === 'help' || command === 'h') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle('🎵 قـائـمـة أوامـر بـوت الـمـوسـيـقـى 🎵')
            .setDescription(`مرحباً بك في لوحة تحكم البوت، الـ Prefix الحالي هو: \`${prefix}\``)
            .addFields(
                { name: `🎤 التشغيل`, value: `\`${prefix}play\` أو \`${prefix}p\` متبوعاً باسم الأغنية أو الرابط مباشر.` },
                { name: `📱 المنصات المدعومة`, value: `• Spotify\n• SoundCloud\n• Anghami (روابط عادية ومختصرة)` },
                { name: `🎮 التحكم`, value: `استخدم الأزرار التفاعلية أسفل المشغل للتحكم الكامل.` }
            )
            .setFooter({ text: 'Designed by: Omar', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        return message.reply({ embeds: [helpEmbed] });
    }

    if (command === 'play' || command === 'p') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ لازم تدخل روم صوتي الأول!');
        if (!query) return message.reply('❌ اكتب اسم الأغنية أو حط اللينك!');

        try {
            const waitingMsg = await message.reply('🔍 جاري فحص الرابط وتحضير التراك...');

            // لو اللينك من أنغامي (مختصر أو عادي) فكه وهات الاسم
            if (query.includes('anghami.com')) {
                const resolvedName = await resolveAnghami(query);
                if (resolvedName) {
                    query = resolvedName; // تحويل الرابط لاسم الأغنية الحقيقي عشان ديسكورد يلقطها
                }
            }

            await client.distube.play(voiceChannel, query, {
                textChannel: message.channel,
                member: message.member,
                message
            });

            await waitingMsg.delete().catch(() => {});
        } catch (error) {
            console.error(error);
            message.reply('❌ حصلت مشكلة أثناء محاولة التشغيل. تأكد أن الرابط صحيح.');
        }
    }
});

client.distube.on('playSong', (queue, song) => {
    const musicEmbed = new EmbedBuilder()
        .setColor('#1DB954')
        .setAuthor({ name: 'جاري التشغيل الآن على TOP Player', iconURL: 'https://i.imgur.com/7vj6LAt.png' })
        .setTitle(`🎶 ${song.name}`)
        .setURL(song.url)
        .setThumbnail(song.thumbnail || 'https://i.imgur.com/7vj6LAt.png')
        .addFields(
            { name: '⏱️ مدة التراك', value: `\`${song.formattedDuration}\``, inline: true },
            { name: '👤 طلب بواسطة', value: `${song.user}`, inline: true },
            { name: '🎚️ مستوى الصوت الحالي', value: `\`%${queue.volume}\``, inline: true },
            { name: '🎵 حالة التشغيل المباشر', value: '▶️ 🔘─────────────────── 00:00' }
        )
        .setFooter({ text: 'Designed by: Omar', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    queue.textChannel.send({
        embeds: [musicEmbed],
        components: [createControllerRow()]
    });
});

// استقبال ضغطات الأزرار
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ مفيش حاجة شغالة حالياً!', ephemeral: true });

    if (interaction.member.voice.channel?.id !== queue.voiceChannel.id) {
        return interaction.reply({ content: '❌ لازم تكون معايا في نفس الروم الصوتي!', ephemeral: true });
    }

    await interaction.deferUpdate();

    try {
        switch (interaction.customId) {
            case 'pause_resume':
                if (queue.paused) {
                    queue.resume();
                    await interaction.followUp({ content: '▶️ تم استئناف تشغيل التراك.', ephemeral: true });
                } else {
                    queue.pause();
                    await interaction.followUp({ content: '⏸️ تم إيقاف التراك مؤقتاً.', ephemeral: true });
                }
                break;

            case 'skip':
                if (queue.songs.length <= 1) {
                    queue.stop();
                    await interaction.followUp({ content: '⏭️ مفيش تراكات تانية، تم إيقاف التشغيل.', ephemeral: true });
                } else {
                    await queue.skip();
                    await interaction.followUp({ content: '⏭️ تم تخطي التراك الحالي بنجاح.', ephemeral: true });
                }
                break;

            case 'voldown':
                let currentVolDown = queue.volume;
                let newVolDown = Math.max(0, currentVolDown - 20);
                queue.setVolume(newVolDown);
                await interaction.followUp({ content: `📉 تم خفض مستوى الصوت إلى: %${newVolDown}`, ephemeral: true });
                break;

            case 'volup':
                let currentVolUp = queue.volume;
                let newVolUp = Math.min(100, currentVolUp + 20);
                queue.setVolume(newVolUp);
                await interaction.followUp({ content: `📈 تم رفع مستوى الصوت إلى: %${newVolUp}`, ephemeral: true });
                break;

            case 'stop':
                queue.stop();
                await interaction.followUp({ content: '🛑 تم إنهاء التشغيل وفصل البوت.', ephemeral: true });
                break;
        }
    } catch (err) {
        console.error(err);
    }
});

client.login(process.env.TOKEN);