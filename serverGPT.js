const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const session = require("express-session");
const cookieParser = require("cookie-parser");

const app = express();
app.use(bodyParser.json());


// Initialization
app.use(cookieParser());

app.use(session({
  secret: "q1w2e3r4t5y6u7i8o9p0",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 120000 } // session timeout of 120 seconds
}));


//exportc WHATSAPP_APPLICATION_CREDENTIALS="fdsgf"
//export GOOGLE_APPLICATION_CREDENTIALS="google_cloud_key.json"
//export OPENAI_API_KEY=""

//Global variables
const token_whatsapp = process.env.WHATSAPP_APPLICATION_CREDENTIALS;
const url_whatsapp = "https://graph.facebook.com/v19.0/";

const conversationArray = [{ conversationId: 0, conversation: {} }];

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
  //Si la session no existe la guardo
  const sessionData = req.session;
  if (!sessionData) {
    sessionData.conversationArray = conversationArray;
    req.session = sessionData;
  } else {
    sessionData.conversationArray = conversationArray;
    req.session = sessionData;
  }
  //console.log(sessionData);
  const conversation = {
    messages: [{ role: "system", content: "Respondeme como un asistente virtual llamado Bowti, que podes brindar informacion sobre, donde esta ubicada la empresa Bowtielabs LLC: Posta de Pardo 1244, Ituzaingo, buenos aires Argentina.Hacemos impresoras 3D de gran escala y desarrollo de software, podes encontrar nuetro sitio web en https://bowtielabs.io. generalemnte estamos disponibles de 9 a 18hs, nos gusta mucho jugar al pingpong, nos apasiona armar equipos, capacitarlos y tener un buen ambiente de trabajo, nuestro mail de contacto es contacto@bowtielabs.io" }],
    //model: "gpt-3.5-turbo",
    model: "gpt-4o",
  };
  const message = req.body;
  if (message.entry && message.entry[0] && message.entry[0].changes && message.entry[0].changes[0].value.messages) {
    const messages = message.entry[0].changes[0].value.messages;
    for (let msg of messages) {
      const from = msg.from; // Número de teléfono del remitente
      const nameFile = from.toString() + '.ogg';
      const audioFilePath = path.join(__dirname, nameFile);
      const conversationId = from;
      if (!findSession(conversationId)) {
        conversationArray.push({ conversationId: conversationId, conversation: conversation });
        sessionData.conversationArray = conversationArray;
      }
      //console.log('CONVERSATION:',findSession(conversationId));
      //console.log(conversationArray);
      if (msg.type === 'audio') {
        const audioId = msg.audio.id; // ID del mensaje de audio
        const mimeType = msg.audio.mime_type; // Tipo MIME del audio
        const url = url_whatsapp + audioId;
        try {
          //Llamo al primer metodo para obtener el ID del Audio.
          const url_whatsapp_audio = await axios.get(url, {
            headers: {
              'Authorization': `Bearer ${token_whatsapp}`,
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
            }
          });
          //Llamo al primer metodo para obtener el ID del Audio.
          //console.log('URL:',url_whatsapp_audio.data.url);
          const audioResponse = await axios.get(url_whatsapp_audio.data.url, {
            headers: {
              'Authorization': `Bearer ${token_whatsapp}`,
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
            },
            responseType: 'arraybuffer',
          });

          const audioBuffer = Buffer.from(audioResponse.data);

          // Paso 3: Escribir el buffer de audio en un archivo en el sistema de archivos local
          fs.writeFileSync(audioFilePath, Buffer.from(audioBuffer));
          // Aquí puedes agregar la lógica para procesar el archivo de audio
          const transcription = await transcribeAudio(conversationId, req, audioFilePath);
          //console.log(transcription);
          await sendTextMessage('txt', msg.from, transcription);

        } catch (error) {
          console.error('Error fetching audio:', error);
          req.session.destroy();
          res.sendStatus(404);
        }
      } else if (msg.type === 'text') {
        const message = msg.text.body; // Texto del mensaje
        if (msg.text.body === '###REINICIAR' || msg.text.body === '###Reiniciar') {
          for (let conversation_ of conversationArray) {
            if (conversation_.conversationId === conversationId) {
              conversation_.conversation = conversation;
              //save conversation to session
              //console.log(conversation_.conversation.messages);
              req.session.conversationArray = conversationArray;
            }
          }
          await chatGPTProcessing(conversationId, req, 'Cerrar Conversacion');
          await sendTextMessage('txt', msg.from, 'Reinicio completo...');
        } else if (msg.text.body === '/help' || msg.text.body === '/Help' || msg.text.body === '/ayuda' || msg.text.body === '/Ayuda') {
          await sendTextMessage('txt', msg.from, 'Puedes enviarme un audio para trasnscribir, si escribis resumir, luego del audio te lo entrego resumido... para reiniciar la conversacion ingresa #reiniciar y si me escribis de cualquier tema te puedo ayudar simulando que soy J.A.R.V.I.S. :)');
        } else if (msg.text.body.split("|")[0] === '###PERSONALIZAR') {
          for (let conversation_ of conversationArray) {
            if (conversation_.conversationId === conversationId) {
              conversation_.conversation.messages.push({ role: "system", content: msg.text.body.split("|")[1] || '' });
              //save conversation to session
              console.log(conversation_.conversation.messages);
              req.session.conversationArray = conversationArray;
            }
          }
          await sendTextMessage('txt', msg.from, 'Nueva personalidad adquirida...');
        } else if (msg.text.body.split("|")[0] === '###ENTRENAR') {
          for (let conversation_ of conversationArray) {
            if (conversation_.conversationId === conversationId) {
              conversation_.conversation.messages.push({ role: "system", content: msg.text.body.split("|")[1] || '' });
              //save conversation to session
              console.log(conversation_.conversation.messages);
              req.session.conversationArray = conversationArray;
            }
          }
          await sendTextMessage('txt', msg.from, 'Entrenamiento completo...');
        } else if (msg.text.body.toLowerCase().includes('crear') && msg.text.body.toLowerCase().includes('imagen')) {
          const gptResponse = await createImageGPT(msg.text.body);
          await sendTextMessage('img', msg.from, gptResponse);
        }
        else {
          const gptResponse = await chatGPTProcessing(conversationId, req, message);
          await sendTextMessage('txt', msg.from, gptResponse.message.content);
        }
      } else {
        const message = msg.text.body; // Texto del mensaje
        await sendTextMessage('txt', msg.from, "Este es un servicio de Transcripcion de Audios desarrollado por Bowtielabs LLC, en breve estaremos integrando IA y muchas funciones mas!!");
        //console.log(`Message from ${from}: ${message}`);
      }

      // Responder con un 200 para confirmar la recepción del mensaje
      res.sendStatus(200);
    }
  }
});

function findSession(conversationId) {
  return conversationArray.find((conversation) => conversation.conversationId === conv
}

// Función para transcribir el archivo de audio utilizando OpenAI
async function transcribeAudio(conversationId, req, audioFilePath) {
  const openai = new OpenAI();
  const conversationArray = req.session.conversationArray;
  for (let conversation_ of conversationArray) {
    if (conversation_.conversationId === conversationId) {
      try {
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(audioFilePath),
          model: "whisper-1",
        });
        conversation_.conversation.messages.push({ role: "assistant", content: transcription.text });
        //save conversation to session
        req.session.conversationArray = conversationArray;
        //console.log(conversationArray);
        return "TRANSCRIPCION: " + transcription.text;
      } catch (error) {
        throw new Error(error.response ? error.response.data : error.message);
      }
    }
  }

}

async function sendTextMessage(_type, to, text) {
  const url = url_whatsapp + '368320819689944/messages';
  var data = {
    messaging_product: "whatsapp",
    to: to,
    text: {
      body: text
    }
  };
  if (_type === 'img') {
    // Datos del mensaje que deseas enviar
      data = {
      messaging_product: "whatsapp",
      to: to,
      type: "image",
      image: {
        link: text, /* Only if linking to your media */
        caption: "Imagen Creada..."
      }
    };
  }

  // Configuración del encabezado, incluyendo el token de acceso
  const config = {
    headers: {
      'Authorization': `Bearer ${token_whatsapp}`,
      'Content-Type': 'application/json'
    }
  };
  
  // Hacer la solicitud POST usando Axios
  axios.post(url, data, config)
    .then(response => {
      //console.log('Mensaje enviado:', response.data);
    })
    .catch(error => {
      console.error('Error al enviar el mensaje:', error.response ? error.response.data : error.message);
    });

}


async function chatGPTProcessing(conversationId, req, user_text) {
  const openai = new OpenAI();
  const conversationArray = req.session.conversationArray;
  try {
    //console.log('conversationArray:', conversationArray);
    for (let conversation_ of conversationArray) {
      if (conversation_.conversationId === conversationId) {
        conversation_.conversation.messages.push({ role: "user", content: user_text });
        const completion = await openai.chat.completions.create(conversation_.conversation);
        conversation_.conversation.messages.push({ role: "assistant", content: completion.choices[0].message.content });
        //save conversation to session
        //console.log(conversation_.conversation.messages);
        req.session.conversationArray = conversationArray;
        return completion.choices[0];
      }
    }
  } catch (error) {
    console.error('Error fetching audio:', error);
    return {message: {content: 'Lo siento, no puedo procesar esa solicitud.'}};
  }
}

async function createImageGPT(user_text) {
  const openai = new OpenAI();
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: user_text,
      n: 1,
      size: "1024x1024",
    });
    //console.log("Imagen: ", response.data[0]);
    return response.data[0].url;
  } catch (error) {
    console.error('Error fetching audio:', error);
    //return { message: { content: 'Lo siento, no puedo procesar esa solicitud.' } };
  }
}


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});