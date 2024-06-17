const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const fetch = require('node-fetch');



const app = express();
app.use(bodyParser.json());

//exportc WHATSAPP_APPLICATION_CREDENTIALS="EAAODQHp5GdsBO0zlD0QZCRZCR6ZCD7jaeUp7T5Wlps3zkkXEX10s5ctX4cWVZBHMMGWsVkZCjtxDEoSIBecWHuiIytmPjUIZBmHruxQ1TTKMsWQLZBnVirvlZBFXAGB6DTTztquAZBrrsAQifz9maUENKir3DHwb1JQn7zU8ZBb02xmSgaKk6cOVvYfVGfEaHE3oI7G9QcnbLZCSpMbtZBqT"
//export GOOGLE_APPLICATION_CREDENTIALS="/Users/mauro/Documents/google_cloud_key.json"
//export OPENAI_API_KEY="sk-apy-key-61zgL22jgKS9rcjjYMaST3BlbkFJ4Q93rgY8D5xwMPKaSjq2"

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


app.post('/webhook', async (req, res) => {
    console.log('Webhook received:', req.body);
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
             
                        // Paso 2: Descargar el archivo de audio utilizando la URL obtenida
                       const audioResponse = await axios.get(url, {
                           headers: {
                               'Authorization': `Bearer ${token_whatsapp}`
                           },
                           responseType: 'arraybuffer'
                       });

                     
                       //TODO VER POR ACA SI NO HAY OTRO METODO QUE PASE EL AUDIO
                       //const audioData = await response.arrayBuffer();
                       const audioBuffer = audioResponse.data;

                       // Guarda el archivo de audio en el sistema de archivos, base de datos, etc.
                       console.log('Audio data received:', audioBuffer);
                       //console.log(response);
                       // console.log('Audio data received:', audioData.toString('base64'));
                          // Paso 3: Escribir el buffer de audio en un archivo en el sistema de archivos local
                       fs.writeFileSync(audioFilePath, Buffer.from(audioBuffer));

                       console.log(`El archivo de audio ha sido guardado en: ${audioFilePath}`);

                       // Aquí puedes agregar la lógica para procesar el archivo de audio
                       const transcription = await transcribeAudio(audioFilePath);
                       //console.log(transcription);
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


// Función para transcribir el archivo de audio utilizando OpenAI
async function transcribeAudio(audioFile) {
    const audioBytes = fs.readFileSync(audioFile).toString('base64');

    console.log(audioBytes); 
    const openai = new OpenAI();
    try {
    const transcription = await openai.audio.transcriptions.create({
            file: audioBytes,
            model: "whisper-1",
      });
      return transcription.text;
    } catch (error) {
      throw new Error(error.response ? error.response.data : error.message);
    }
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
        //console.error('Error enviando mensaje:', response.statusText);
    } else {
        const responseData = await response.json();
        console.log('Mensaje enviado:', responseData);
    }
}


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});