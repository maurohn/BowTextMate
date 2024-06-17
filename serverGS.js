const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const speech = require('@google-cloud/speech');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

//export WHATSAPP_APPLICATION_CREDENTIALS="EAAODQHp5GdsBO0zlD0QZCRZCR6ZCD7jaeUp7T5Wlps3zkkXEX10s5ctX4cWVZBHMMGWsVkZCjtxDEoSIBecWHuiIytmPjUIZBmHruxQ1TTKMsWQLZBnVirvlZBFXAGB6DTTztquAZBrrsAQifz9maUENKir3DHwb1JQn7zU8ZBb02xmSgaKk6cOVvYfVGfEaHE3oI7G9QcnbLZCSpMbtZBqT"
//export GOOGLE_APPLICATION_CREDENTIALS="/Users/mauro/Documents/google_cloud_key.json"

//Global variables
const token_whatsapp = process.env.WHATSAPP_APPLICATION_CREDENTIALS;
const google_cloud_key = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const url_whatsapp = "https://graph.facebook.com/v19.0/";
// Ruta donde se guardará el nuevo archivo de audio
const audioFilePath = path.join(__dirname, 'audio_from_whatsapp.ogg');
// Configurar el cliente de Google Cloud Speech
const client = new speech.SpeechClient({
    keyFilename: google_cloud_key
});

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
    //console.log('Webhook received:', req.body);
    const message = req.body;
    if (message.entry && message.entry[0] && message.entry[0].changes && message.entry[0].changes[0].value.messages) {
        const messages = message.entry[0].changes[0].value.messages;
        for (let msg of messages) {

                const from = msg.from; // Número de teléfono del remitente

                if (msg.type === 'audio') {
                    const audioId = msg.audio.id; // ID del mensaje de audio
                    const mimeType = msg.audio.mime_type; // Tipo MIME del audio
                    const url = url_whatsapp + audioId;
                    try {
                        const url_whatsapp_audio = await axios.get(url, {
                            headers: {
                                'Authorization': `Bearer ${token_whatsapp}`,
                                "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
                            // "NONISV|MyBot|MyBot/12.0",
                            }
                        });
                        console.log('URL:',url_whatsapp_audio.data.url);
                        const audioResponse = await axios.get(url_whatsapp_audio.data.url, {
                            headers: {
                                'Authorization': `Bearer ${token_whatsapp}`,
                                "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
                            // "NONISV|MyBot|MyBot/12.0",
                            },
                             responseType: 'arraybuffer',
                        });
                               
                        console.log('RESPONSE:', audioResponse);
                        
                        const audioBuffer = Buffer.from(audioResponse.data);
                        const transcription = await transcribeAudio(audioBuffer);
                        console.log(transcription);
                        // await sendTextMessage(msg.from, transcription);

                    } catch (error) {
                        console.error('Error fetching audio:', error);
                        res.sendStatus(404);
                    }
                } else if (msg.type === 'text')  {
                    const message = msg.text.body; // Texto del mensaje
                    console.log(`Message from ${from}: ${message}`);
                    // Aquí puedes agregar la lógica para procesar el mensaje
                }

                // Responder con un 200 para confirmar la recepción del mensaje
                res.sendStatus(200);
            }
    }
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
  const url = url_whatsapp + 'messages';
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
             'Authorization': `Bearer ${nodem}`
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