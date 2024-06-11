const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const speech = require('@google-cloud/speech');
const client = new speech.SpeechClient();

const app = express();
app.use(bodyParser.json());

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

app.post('/webhook', async (req, res) => {
    const message = req.body;
    if (message.entry && message.entry[0] && message.entry[0].changes && message.entry[0].changes[0].value.messages) {
        const messages = message.entry[0].changes[0].value.messages;
        for (let msg of messages) {
            if (msg.type === 'audio') {
                const audioUrl = msg.audio.url;
                const audioResponse = await fetch(audioUrl);
                const audioBuffer = await audioResponse.buffer();
                const transcription = await transcribeAudio(audioBuffer);
                await sendTextMessage(msg.from, transcription);
            }
        }
    }
    res.sendStatus(200);
});

async function transcribeAudio(audioFile) {
    const audio = {
        content: audioFile.toString('base64'),
    };
    const config = {
        encoding: 'AMR_WB',
        sampleRateHertz: 16000,
        languageCode: 'es-ES',
    };
    const request = {
        audio: audio,
        config: config,
    };

    const [response] = await client.recognize(request);
    const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
    console.log(`Transcription: ${transcription}`);
    return transcription;
}

async function sendTextMessage(to, text) {
  const url = `https://graph.facebook.com/v19.0/334466229750599/messages`;
    const data = {
        messaging_product: "whatsapp",
        to: to,
        text: {
            body: text,
        },
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer EAAODQHp5GdsBOZChXI30CXvKILTAEPK3fmPZCVjDRmwGsXHK9zZAiK21bmGWFZCGf5ekkdf8EjDZBSIsIQ1ZCQbrtBmCdkXQluQCELaLadNiDV09u5wWLVXtFYrufAAcZCSQJf6v8Kb3IA21OFOPmQ2RQ11QIhvNj3WZAOkWuO6ZAegs5sWQ5SpqSxE8XoHapSbeUK23x0ORSZA5LmMKtk`,
          },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        console.error('Error enviando mensaje:', response.statusText);
    } else {
        const responseData = await response.json();
        console.log('Mensaje enviado:', responseData);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
