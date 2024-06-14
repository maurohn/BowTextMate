const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const speech = require('@google-cloud/speech');


const app = express();
app.use(bodyParser.json());

// Configurar el cliente de Google Cloud Speech
const client = new speech.SpeechClient({
    keyFilename: '../google_cloud_key.json' // Reemplaza con la ruta a tu archivo de clave JSON
    //export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your-service-account-file.json"

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
    console.log('Webhook received:', req.body);

    const messagingEvent = req.body.entry[0].changes[0].value.messages[0];
    if (messagingEvent) {
        const from = messagingEvent.from; // Número de teléfono del remitente

        if (messagingEvent.type === 'audio') {
            const audioId = messagingEvent.audio.id; // ID del mensaje de audio
            const mimeType = messagingEvent.audio.mime_type; // Tipo MIME del audio

            // Aquí puedes usar la API de WhatsApp Business para obtener el archivo de audio
            const token = 'EAAODQHp5GdsBO8FPO42drNijr3o2bHMnreQhFehT9JqQMJ3YCnNZAhEbPJtZBPpZBAYnjQZB9dwj7AcSUikPZAeR1ZCcdMMdXAsPwtI9p5A2ZA7Ka4srSWY02VSHRivUzuw9EDkkZCj3Un0SPnXWUFZCHEcZAeDAdy9kaVOjrqirFX8Q3x62BUvVQX8pyU9iPqVDSv6Yc6IsB2nlTqiWXy'; // Reemplaza con tu token de acceso
            const url = `https://graph.facebook.com/v16.0/${audioId}`;

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                //TODO VER POR ACA SI NO HAY OTRO METODO QUE PASE EL AUDIO
                const audioData = await response.arrayBuffer();

                // Guarda el archivo de audio en el sistema de archivos, base de datos, etc.
                console.log('Audio data received:', audioData);
                console.log('Audio data received:', audioData.toString('base64'));
                

                // Aquí puedes agregar la lógica para procesar el archivo de audio
                const transcription = await transcribeAudio(audioData);
                // await sendTextMessage(msg.from, transcription);

            } catch (error) {
                console.error('Error fetching audio:', error);
                res.sendStatus(404);
            }
        } else if (messagingEvent.type === 'text')  {
            const message = messagingEvent.text.body; // Texto del mensaje
            console.log(`Message from ${from}: ${message}`);
            // Aquí puedes agregar la lógica para procesar el mensaje
        }

        // Responder con un 200 para confirmar la recepción del mensaje
        res.sendStatus(200);
    }
});

async function transcribeAudio(audioFile) {
    const base64Audio = Buffer.from(audioFile).toString('base64');
    const audio = {
        content: base64Audio,
    };
    const config = {
        encoding: 'OGG_OPUS',
        sampleRateHertz: 16000,
        languageCode: 'es-ES',
    };
    const request = {
        audio: audio,
        config: config,
    };
    console.log(audio);
    const [response] = await client.recognize(request);
    const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
    console.log(`Transcription: ${transcription}`);
    console.log(response.results);
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