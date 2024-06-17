import express, { response } from "express";
import bodyParser from "body-parser";
import speech from "@google-cloud/speech";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { pipeline } from '@xenova/transformers';
import wavefile from 'wavefile';
import toWav from 'audiobuffer-to-wav';
import { OpusDecoder } from 'opus-decoder';
import decodeAudio from 'audio-decode';



let transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

let server = express();

const port = process.env.PORT || 3000;

const token_whatsapp = process.env.WHATSAPP_APPLICATION_CREDENTIALS;
const google_cloud_key = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const url_whatsapp = "https://graph.facebook.com/v19.0/";
// Ruta donde se guardará el nuevo archivo de audio
const audioFilePath = path.join(__dirname, 'audio_from_whatsapp.ogg');
// Configurar el cliente de Google Cloud Speech
const client = new speech.SpeechClient({
    keyFilename: google_cloud_key
});


server.use(bodyParser.json());

server.use(function (req, res, next) {
    res.header("Content-Type", "application/json");
    // Dominio que tengan acceso (ej. 'http://example.com')
    res.setHeader('Access-Control-Allow-Origin', '*');

   // Metodos de solicitud que deseas permitir
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
   
   // Encabecedados que permites (ej. 'X-Requested-With,content-type')
    res.setHeader('Access-Control-Allow-Headers', '*');
   
   next();
});

server.get("/", async (req, res) => {
    res.status(200).json({
        status: "OK",
        message: `welcome to Server`,
    });
});

server.post("/audio", async (req, res) => {
    console.log('Webhook received:', req.body);
    const messagingEvent = req.body.entry[0].changes[0].value.messages[0];
    if (messagingEvent) {
        const from = messagingEvent.from; // Número de teléfono del remitente
        if (messagingEvent.type === 'audio') {
            const audioId = messagingEvent.audio.id; // ID del mensaje de audio
            const mimeType = messagingEvent.audio.mime_type; // Tipo MIME del audio

            // Aquí puedes usar la API de WhatsApp Business para obtener el archivo de audio
            const token = 'EAAODQHp5GdsBO8FPO42drNijr3o2bHMnreQhFehT9JqQMJ3YCnNZAhEbPJtZBPpZBAYnjQZB9dwj7AcSUikPZAeR1ZCcdMMdXAsPwtI9p5A2ZA7Ka4srSWY02VSHRivUzuw9EDkkZCj3Un0SPnXWUFZCHEcZAeDAdy9kaVOjrqirFX8Q3x62BUvVQX8pyU9iPqVDSv6Yc6IsB2nlTqiWXy'; // Reemplaza con tu token de acceso
            //export WHATSAPP_APPLICATION_CREDENTIALS="EAAODQHp5GdsBO0zlD0QZCRZCR6ZCD7jaeUp7T5Wlps3zkkXEX10s5ctX4cWVZBHMMGWsVkZCjtxDEoSIBecWHuiIytmPjUIZBmHruxQ1TTKMsWQLZBnVirvlZBFXAGB6DTTztquAZBrrsAQifz9maUENKir3DHwb1JQn7zU8ZBb02xmSgaKk6cOVvYfVGfEaHE3oI7G9QcnbLZCSpMbtZBqT"
            const urlface = `https://graph.facebook.com/v16.0/${audioId}`;

            const response = await fetch(urlface, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                //TODO VER POR ACA SI NO HAY OTRO METODO QUE PASE EL AUDIO
                const audioData = await response.arrayBuffer();
                const audioBuffer = await decodeAudio(audioData)

                console.log('Audio data:', audioBuffer);
                transcribir(audioData);
                // Guarda el archivo de audio en el sistema de archivos, base de datos, etc.
                console.log('Audio data received:', audioData); 
                // Aquí puedes agregar la lógica para procesar el archivo de audio
                    //const transcription = await transcribeAudio(audioData);

                // await sendTextMessage(msg.from, transcription);

        } else if (messagingEvent.type === 'text')  {
            const message = messagingEvent.text.body; // Texto del mensaje
            console.log(`Message from ${from}: ${message}`);
            // Aquí puedes agregar la lógica para procesar el mensaje
        }
        // Responder con un 200 para confirmar la recepción del mensaje
        //res.status(200).send('ok');
    }
});
    
let url = 'https://www.lightbulblanguages.co.uk/resources/sp-audio/hola.mp3';
//let buffer = Buffer.from(await fetch(url).then(x => x.arrayBuffer())) 

// Read .wav file and convert it to required format
const  transcribir = async (data) => {
let wav = new wavefile.WaveFile(data);
    wav.toBitDepth('32f'); // Pipeline expects input as a Float32Array
    wav.toSampleRate(16000); // Whisper expects audio with a sampling rate of 16000
    let audioData = wav.getSamples();
    if (Array.isArray(audioData)) {
    if (audioData.length > 1) {
        const SCALING_FACTOR = Math.sqrt(2);

        // Merge channels (into first channel to save memory)
        for (let i = 0; i < audioData[0].length; ++i) {
        audioData[0][i] = SCALING_FACTOR * (audioData[0][i] + audioData[1][i]) / 2;
        }
    }

    // Select first channel
    audioData = audioData[0];
    }
    let start = performance.now();
    let output = await transcriber(audioData);
    let end = performance.now();
    console.log(`Execution duration: ${(end - start) / 1000} seconds`);
    console.log(output);

    res.status(200).json({
        status: "OK",
        message: output,
    });
}

server.get("/webhook", async (req, res) => {
    const VERIFY_TOKEN = 'q1w2e3r4t5y6u7i8o9p0';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).json("challenge");
        } else {
            res.status(403).json(
                {
                    status:"denied"
                });
        }
    }else{
        res.status(500).json(
            {
                status:"data missing"
            });
    }
});


server.post('/webhook', async (req, res) => {
    console.log('Webhook received:', req.body);
    const messagingEvent = req.body.entry[0].changes[0].value.messages[0];
    if (messagingEvent) {
        const from = messagingEvent.from; // Número de teléfono del remitente
        if (messagingEvent.type === 'audio') {
            const audioId = messagingEvent.audio.id; // ID del mensaje de audio
            const mimeType = messagingEvent.audio.mime_type; // Tipo MIME del audio

            // Aquí puedes usar la API de WhatsApp Business para obtener el archivo de audio
            const token = 'EAAODQHp5GdsBO8FPO42drNijr3o2bHMnreQhFehT9JqQMJ3YCnNZAhEbPJtZBPpZBAYnjQZB9dwj7AcSUikPZAeR1ZCcdMMdXAsPwtI9p5A2ZA7Ka4srSWY02VSHRivUzuw9EDkkZCj3Un0SPnXWUFZCHEcZAeDAdy9kaVOjrqirFX8Q3x62BUvVQX8pyU9iPqVDSv6Yc6IsB2nlTqiWXy'; // Reemplaza con tu token de acceso
            //export WHATSAPP_APPLICATION_CREDENTIALS="EAAODQHp5GdsBO0zlD0QZCRZCR6ZCD7jaeUp7T5Wlps3zkkXEX10s5ctX4cWVZBHMMGWsVkZCjtxDEoSIBecWHuiIytmPjUIZBmHruxQ1TTKMsWQLZBnVirvlZBFXAGB6DTTztquAZBrrsAQifz9maUENKir3DHwb1JQn7zU8ZBb02xmSgaKk6cOVvYfVGfEaHE3oI7G9QcnbLZCSpMbtZBqT"
            const url = `https://graph.facebook.com/v16.0/${audioId}`;

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    res.status(404).send(res.err);

                }
                //TODO VER POR ACA SI NO HAY OTRO METODO QUE PASE EL AUDIO
                const audioData = await response.arrayBuffer();
                // Guarda el archivo de audio en el sistema de archivos, base de datos, etc.
                console.log('Audio data received:', audioData);
                console.log('Audio data received64:', audioData.toString('base64'));
                // Aquí puedes agregar la lógica para procesar el archivo de audio
                    //const transcription = await transcribeAudio(audioData);
                    res.send(audioData.toString('base64'));

                // await sendTextMessage(msg.from, transcription);
            } catch (error) {
                console.error('Error fetching audio:', error);
                //res.status(404).send('error');
            }
        } else if (messagingEvent.type === 'text')  {
            const message = messagingEvent.text.body; // Texto del mensaje
            console.log(`Message from ${from}: ${message}`);
            // Aquí puedes agregar la lógica para procesar el mensaje
        }
        // Responder con un 200 para confirmar la recepción del mensaje
        //res.status(200).send('ok');

    }
});


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
        console.error('Error enviando mensaje:', response.statusText);
    } else {
        const responseData = await response.json();
        console.log('Mensaje enviado:', responseData);
    }
}


server.listen(port, function () {
    console.log("server app listening on port:", port);
    console.log("version:", "1");
});