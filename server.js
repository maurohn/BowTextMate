



//exportc WHATSAPP_APPLICATION_CREDENTIALS="EAAODQHp5GdsBO0zlD0QZCRZCR6ZCD7jaeUp7T5Wlps3zkkXEX10s5ctX4cWVZBHMMGWsVkZCjtxDEoSIBecWHuiIytmPjUIZBmHruxQ1TTKMsWQLZBnVirvlZBFXAGB6DTTztquAZBrrsAQifz9maUENKir3DHwb1JQn7zU8ZBb02xmSgaKk6cOVvYfVGfEaHE3oI7G9QcnbLZCSpMbtZBqT"

const config = {
    headers: {
      "Authorization": `Bearer ${whatsapp_token}`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
      // "NONISV|MyBot|MyBot/12.0",
    },
    responseType: "arraybuffer",
    };
//Global variables
const token_whatsapp = process.env.WHATSAPP_APPLICATION_CREDENTIALS;
const url_whatsapp = "https://graph.facebook.com/v19.0/";
// Ruta donde se guardará el nuevo archivo de audio
const audioFilePath = path.join(__dirname, 'audio_from_whatsapp.ogg');

app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = 'q1w2e3r4t5y6u7i8o9p0';

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});
