import { Hono } from 'hono'
import { google } from 'googleapis'
import { GoogleGenerativeAI } from '@google/generative-ai'
import TelegramBot from 'node-telegram-bot-api'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import axios from 'axios'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { fileURLToPath } from 'url'
import Groq from 'groq-sdk'



// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = new Hono()

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

// Initialize Gemini with API key
const genAI = new GoogleGenerativeAI(process.env['GEMINI_API_KEY']!)

// Initialize Telegram Bot
const bot = new TelegramBot(process.env['TELEGRAM_BOT_TOKEN']!, { polling: true })

// Initialize Groq with API key
const groq = new Groq({ apiKey: process.env['GROQ_API_KEY'] })

// Google Sheets API setup with credentials from .env
const auth = new google.auth.GoogleAuth({
    credentials: {
        type: 'service_account',
        project_id: process.env['GOOGLE_PROJECT_ID'],
        private_key_id: process.env['GOOGLE_PRIVATE_KEY_ID'],
        private_key: process.env['GOOGLE_PRIVATE_KEY'],
        client_email: process.env['GOOGLE_CLIENT_EMAIL'],
        client_id: process.env['GOOGLE_CLIENT_ID'],
        universe_domain: 'googleapis.com',
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})
const sheets = google.sheets({ version: 'v4', auth })

// Your Google Sheet ID
const SPREADSHEET_ID = '1ghGxHKYcoVHa3JAEvnU0K9pzTlxciBvYv8-nj-_X8r8'

// Function to convert text to speech using ElevenLabs
async function textToSpeech(text: string, chatId: string | number): Promise<string> {
    const outputPath = path.join(__dirname, `voice_response_${chatId}_${Date.now()}.mp3`)
    try {
        const response = await axios({
            method: 'POST',
            url: 'https://api.elevenlabs.io/v1/text-to-speech/5UK7mqtKP0xl505xNPZG', // Default voice ID, replace with your preferred voice ID from ElevenLabs
            headers: {
                'xi-api-key': process.env['ELEVENLABS_API_KEY'],
                'Content-Type': 'application/json',
            },
            data: {
                text: text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5,
                },
            },
            responseType: 'stream',
        })

        const writer = fs.createWriteStream(outputPath)
        response.data.pipe(writer)

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(outputPath))
            writer.on('error', (err) => reject(new Error('Error writing audio file: ' + err.message)))
        })
    } catch (error) {
        console.log("error in textToSpeech>>>>>", error)
        throw new Error('Error with ElevenLabs API: ' + error)
    }
}

// Existing Functions
async function infer_category(description: string): Promise<string> {
    const categories = [
        'Income', 'Food', 'Clothes', 'Transport', 'Entertainment', 
        'Student Materials', 'Debt Given', 'Debt Returned', 'Non expense', 
        'Other', 'Unlisted'
    ]

    const systemPrompt = `
        You are a helpful assistant tasked with categorizing financial transactions. 
        Given the description of a transaction, determine the most appropriate category 
        from the following list: ${categories.join(', ')}. 
        Return only the category name as a plain string, nothing else. 
        If unsure, default to 'Other'. By the way, consider addictions in Entertainment
    `

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
        const result = await model.generateContent([systemPrompt, description])
        const inferredCategory = result.response.text().trim()
        return categories.includes(inferredCategory) ? inferredCategory : 'Other'
    } catch (error) {
        console.error('Error inferring category:', error)
        return 'Other'
    }
}

async function get_current_date() {
    const today = new Date()
    return {
        success: true,
        result: {
            day: today.getDate(),
            month: today.getMonth() + 1,
            year: today.getFullYear(),
            formatted: today.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
        }
    }
}

async function add_entry_to_sheet({ amount, description, category, type, month }: { amount: number, description: string, category?: string, type: string, month?: string }) {
    const today = new Date()
    const monthNumeric = month ? parseMonth(month) : (today.getMonth() + 1).toString()
    const date = today.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const income = type === 'income' ? amount : 0
    const debits = type === 'expense' ? amount : 0
    const finalCategory = category || (await infer_category(description))

    const values = [[monthNumeric, date, description, finalCategory, income, debits]]

    try {
        const lastRowResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Budget!J18',
        })
        let lastRow = lastRowResponse.data.values?.[0]?.[0] ? parseInt(lastRowResponse.data.values[0][0]) : 1
        let nextRow = Math.min(lastRow + 1, 954)
        if (nextRow < 2) nextRow = 2

        const targetRange = `Budget!A${nextRow}:F${nextRow}`
        const updateResponse = await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: targetRange,
            valueInputOption: 'USER_ENTERED',
            resource: { values },
        })

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Budget!J18',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[nextRow]] },
        })

        let message = `Added ${type} of ${amount} rs for ${description} (Category: ${finalCategory}) at row ${nextRow}`

        if (type === 'expense' && monthNumeric === (new Date().getMonth() + 1).toString()) {
            const currentMonth = (new Date().getMonth() + 1).toString()
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Budget!I2',
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[currentMonth]] },
            })

            const budgetResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Budget!J20:J21',
            })
            const budgetValues = budgetResponse.data.values || [['0'], ['0']]
            const budget = parseFloat(budgetValues[0][0].replace(/[^0-9.-]+/g, '')) || 0
            const budgetLeft = parseFloat(budgetValues[1][0].replace(/[^0-9.-]+/g, '')) || 0

            const percentageLeft = budget > 0 ? (budgetLeft / budget) * 100 : 0

            if (percentageLeft < 25) {
                message += ` Your budget for this month is ₹${budget}, with ₹${budgetLeft} left (${percentageLeft.toFixed(2)}%). Be more careful and cautious about your spending.`
            } else if (percentageLeft < 50) {
                message += ` Your budget for this month is ₹${budget}, with ₹${budgetLeft} left (${percentageLeft.toFixed(2)}%). Be a bit careful with your spending.`
            }
        }

        console.log('Entry added at row:', nextRow, updateResponse.data)
        return { success: true, message }
    } catch (error) {
        console.error('Error adding entry:', error)
        return { success: false, error: (error as Error).message }
    }
}

async function query_sheet({ month }: { month?: string }) {
    const numericMonth = month ? parseMonth(month) : (new Date().getMonth() + 1).toString()

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Budget!I2',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[numericMonth]] },
        })

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Budget!I3:J15',
        })
        const rows = response.data.values || []

        const categories = {
            'Income': rows[0][1],
            'Food': rows[1][1],
            'Clothes': rows[2][1],
            'Transport': rows[3][1],
            'Entertainment': rows[4][1],
            'Student Materials': rows[5][1],
            'Other': rows[6][1],
            'Expenditure': rows[7][1],
            'Net Spend': rows[8][1],
            'Net Income': rows[9][1],
            'Debt Given': rows[10][1],
            'Debt Returned': rows[11][1],
            'Debt Not Returned': rows[12][1]
        }

        return { success: true, result: { categories, month: numericMonth } }
    } catch (error) {
        console.error('Error querying sheet:', error)
        return { success: false, error: (error as Error).message }
    }
}

async function get_all_entries() {
    try {
        const lastRowResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Budget!J18',
        })
        const lastRow = lastRowResponse.data.values?.[0]?.[0] ? parseInt(lastRowResponse.data.values[0][0]) : 1

        const range = `Budget!A2:G${lastRow}`
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        })
        const rows = response.data.values || []

        const entries = rows.map(row => ({
            month: row[0],
            date: row[1],
            description: row[2],
            category: row[3],
            income: row[4],
            debits: row[5],
            balance: row[6]
        }))

        return { success: true, entries }
    } catch (error) {
        console.error('Error fetching all entries:', error)
        return { success: false, error: (error as Error).message }
    }
}

async function get_budget_status() {
    const currentMonth = (new Date().getMonth() + 1).toString()

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Budget!I2',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[currentMonth]] },
        })

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Budget!J20:J21',
        })
        const values = response.data.values || [['0'], ['0']]
        const budget = parseFloat(values[0][0].replace(/[^0-9.-]+/g, '')) || 0
        const budgetLeft = parseFloat(values[1][0].replace(/[^0-9.-]+/g, '')) || 0

        const percentageLeft = budget > 0 ? (budgetLeft / budget) * 100 : 0

        let warning = ''
        if (percentageLeft < 25) {
            warning = 'Be more careful and cautious about your spending.'
        } else if (percentageLeft < 50) {
            warning = 'Be a bit careful with your spending.'
        }

        return {
            success: true,
            result: {
                month: currentMonth,
                budget: budget,
                budgetLeft: budgetLeft,
                percentageLeft: percentageLeft.toFixed(2),
                warning: warning
            }
        }
    } catch (error) {
        console.error('Error getting budget status:', error)
        return { success: false, error: (error as Error).message }
    }
}

async function set_budget_for_month({ amount }: { amount: number }) {
    const currentMonth = (new Date().getMonth() + 1).toString()

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Budget!J20',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[amount]] },
        })

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Budget!I2',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[currentMonth]] },
        })

        const budgetResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Budget!J20:J21',
        })
        const budgetValues = budgetResponse.data.values || [['0'], ['0']]
        const budget = parseFloat(budgetValues[0][0].replace(/[^0-9.-]+/g, '')) || 0
        const budgetLeft = parseFloat(budgetValues[1][0].replace(/[^0-9.-]+/g, '')) || 0

        const percentageLeft = budget > 0 ? (budgetLeft / budget) * 100 : 0

        let warning = ''
        if (percentageLeft < 25) {
            warning = 'Be more careful and cautious about your spending.'
        } else if (percentageLeft < 50) {
            warning = 'Be a bit careful with your spending.'
        }

        const message = `Set budget for this month to ₹${budget}. You have ₹${budgetLeft} left (${percentageLeft.toFixed(2)}%). ${warning}`.trim()
        return { success: true, message }
    } catch (error) {
        console.error('Error setting budget:', error)
        return { success: false, error: (error as Error).message }
    }
}

function parseMonth(monthStr?: string): string {
    const monthMap: { [key: string]: string } = {
        'january': '1', 'february': '2', 'march': '3', 'april': '4', 'may': '5', 'june': '6',
        'july': '7', 'august': '8', 'september': '9', 'october': '10', 'november': '11', 'december': '12'
    }
    return monthMap[monthStr?.toLowerCase()] || monthStr || (new Date().getMonth() + 1).toString()
}

const functions = {
    add_entry_to_sheet,
    query_sheet,
    get_all_entries,
    get_budget_status,
    set_budget_for_month,
    get_current_date
}

const tools = [
    {
        functionDeclarations: [
            {
                name: 'add_entry_to_sheet',
                description: 'Adds a new entry to the financial tracker Google Sheet within rows 2-954, updating last appended row in J18. For expenses in the current month, includes budget status if below 50% or 25%.',
                parameters: {
                    type: 'object',
                    properties: {
                        amount: { type: 'number', description: 'The amount of money involved.' },
                        description: { type: 'string', description: 'Description of the transaction.' },
                        category: {
                            type: 'string',
                            enum: ['Income', 'Food', 'Clothes', 'Transport', 'Entertainment', 'Student Materials', 'Debt Given', 'Debt Returned', 'Non expense', 'Other', 'Unlisted'],
                            description: 'The category of the transaction (optional, will be inferred if omitted).'
                        },
                        type: { type: 'string', enum: ['expense', 'income'], description: 'Whether it’s an expense or income.' },
                        month: { type: 'string', description: 'The month as a number (1-12), defaults to current month if omitted.' }
                    },
                    required: ['amount', 'description', 'type']
                }
            },
            {
                name: 'query_sheet',
                description: 'Queries the financial tracker Google Sheet for category totals (e.g., Income, Debt Given, Debt Returned) in a specified month. Use this for summarized financial data, such as total debts owed to you or expenses in a given month. Month parameter accepts numbers (1-12) or names (e.g., "February").',
                parameters: {
                    type: 'object',
                    properties: {
                        month: { type: 'string', description: 'The month to query (e.g., "February" or "2"), defaults to current month if omitted.' }
                    },
                    required: []
                }
            },
            {
                name: 'get_all_entries',
                description: 'Fetches all financial entries from the Google Sheet up to the last appended row.'
            },
            {
                name: 'get_budget_status',
                description: 'Fetches the budget and remaining amount for the current month, with spending warnings if below 50% or 25%.'
            },
            {
                name: 'set_budget_for_month',
                description: 'Sets the budget for the current month in the financial tracker Google Sheet and returns the updated budget status.',
                parameters: {
                    type: 'object',
                    properties: {
                        amount: { type: 'number', description: 'The budget amount to set for the current month.' }
                    },
                    required: ['amount']
                }
            },
            {
                name: 'get_current_date',
                description: 'Returns the current date, including day, month (1-12), year, and formatted string (DD/MM/YYYY). Use this to determine relative time periods like "last month" or "this month" in queries.'
            }
        ]
    }
]

// Hono Routes
app.get('/', (c) => {
    return c.text('Hello Hono!')
})

app.post('/finance', async (c) => {
    const body = await c.req.json()
    const { query } = body

    if (!query) {
        return c.json({ error: 'Query is required' }, 400)
    }

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            tools: tools,
            systemInstruction: `
                You are a financial assistant that helps users track expenses, income, and debts in a Google Sheet.
                - When a user mentions spending money (e.g., "I spent X on Y"), interpret it as an expense and call 'add_entry_to_sheet' with type: "expense" unless explicitly stated otherwise.
                - For income-related queries (e.g., "I earned X from Y", "He gave me X money", "I got X money for this month", "I got X salary"), interpret it as income and call 'add_entry_to_sheet' with type: "income".
                - For queries about who owes money or specific debt details (e.g., "who owes me money"), call 'get_all_entries' to fetch all financial entries, then analyze the results to identify entries with category "Debt Given" that haven’t been matched by "Debt Returned". Summarize the relevant debts in your response.
                - For queries about total amounts owed to you in a specific month (e.g., "how much money is owed to me last month"), call 'get_current_date' to determine the current month, calculate the requested month (e.g., "last month" is current month - 1), then call 'query_sheet' with the calculated month (as a number, 1-12) to get category totals. Focus on the "Debt Given" category and return the total.
                - Use the provided tools directly without asking for confirmation unless the intent is unclear.
                - If the category is not specified in an entry, it will be inferred automatically by the function.
                - For financial status or history, choose 'query_sheet' for monthly summaries, 'get_all_entries' for detailed records, or 'get_budget_status' for current budget info.
            `
        })

        const chat = model.startChat({ history: [] })
        let result = await chat.sendMessage(query)
        let response = result.response

        console.log("initial response from LLM>>>>", response)

        let finalResponse = ''

        while (true) {
            const functionCalls = response.functionCalls ? response.functionCalls() : []
            console.log("function calls>>>>", functionCalls)
            if (!functionCalls || functionCalls.length === 0) break

            const functionResponses = []

            for (const call of functionCalls) {
                const { name, args } = call

                console.log("call in functionCalls>>>>", call)

                if (functions[name]) {
                    const functionResult = await functions[name](args)

                    console.log("functionResult after executing in my code>>>>", functionResult)

                    if (functionResult.success) {
                        finalResponse = functionResult.result ? 
                            (typeof functionResult.result === 'string' ? functionResult.result : JSON.stringify(functionResult.result)) : 
                            functionResult.message || JSON.stringify(functionResult.entries)
                    } else {
                        finalResponse = `Error: ${functionResult.error}`
                        break
                    }

                    functionResponses.push({
                        functionResponse: {
                            name,
                            response: functionResult
                        }
                    })

                    console.log("functionResponses after push?>>>>>", functionResponses)
                }
            }

            if (functionResponses.length > 0 && !finalResponse.startsWith('Error')) {
                console.log("after all calls, final functionResponses before sending to LLM?>>>>>", functionResponses)

                result = await chat.sendMessage(functionResponses)
                response = result.response

                console.log("response after final functionResponses query?>>>>>", response)

                if (!response.functionCalls || !response.functionCalls()) {
                    finalResponse = response.text() || finalResponse
                    console.log("finalResponse after all the calls and passing functionResponses>>>>", finalResponse)
                }
            } else {
                console.log("why break?")
                break
            }
        }

        if (!finalResponse && response.text()) {
            finalResponse = response.text()
            console.log("no final response so just putting the initial response here>>>", finalResponse)
        }

        return c.json({ response: finalResponse || 'Sorry, I couldn’t process your request.' })
    } catch (error) {
        console.error('Error processing request:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Function to download file from Telegram
async function downloadFile(fileId: string, chatId: string | number): Promise<string> {
    try {
        const fileLink = await bot.getFileLink(fileId)
        const filePath = path.join(__dirname, `voice_${chatId}_${Date.now()}.ogg`)
        const response = await axios({
            url: fileLink,
            method: 'GET',
            responseType: 'stream',
        })
        const writer = fs.createWriteStream(filePath)
        response.data.pipe(writer)
        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(filePath))
            writer.on('error', reject)
        })
    } catch (error) {
        throw new Error('Error downloading voice file: ' + (error as Error).message)
    }
}

// Function to convert OGG to MP3
async function convertToMp3(inputPath: string, chatId: string | number): Promise<string> {
    const outputPath = path.join(__dirname, `voice_${chatId}_${Date.now()}.mp3`)
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('mp3')
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(new Error('Error converting to MP3: ' + err.message)))
            .save(outputPath)
    })
}

// Function to transcribe audio using Groq
async function transcribeAudio(filePath: string): Promise<string> {
    try {
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: 'whisper-large-v3',
            response_format: 'text',
        })
        console.log("transcription>>>>>", transcription)
        return transcription
    } catch (error) {
        throw new Error('Error transcribing audio with Groq: ' + (error as Error).message)
    } finally {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }
    }
}

// Telegram Bot Integration for Text
bot.on('message', async (msg) => {

    // Make a request to the root endpoint to keep the server active
    try {
        await fetch(`${process.env['PROD_URL']}/`)
        console.log("Server ping successful")
    } catch (error) {
        console.error('Error pinging server:', error)
    }
    if (msg.voice) return
    const chatId = msg.chat.id
    console.log("chatId>>>", chatId)

    const userQuery = msg.text
    console.log("userquery>>>", userQuery)
    if (!userQuery) return

    let audioPath: string | undefined

    try {
        const response = await fetch(`${process.env['PROD_URL']}/finance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: userQuery })
        })

        const data = await response.json()
        const botResponse = data.response || 'Sorry, I couldn’t process your request.'

        // Send text response
        await bot.sendMessage(chatId, botResponse)

        // // Generate and send voice response
        // audioPath = await textToSpeech(botResponse, chatId)
        // await bot.sendVoice(chatId, audioPath)
    } catch (error) {
        console.error('Error handling Telegram message:', error)
        await bot.sendMessage(chatId, 'An error occurred while processing your request.')
    } finally {
        if (audioPath && fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath)
        }
    }
})

// Telegram Bot Integration for Voice
bot.on('voice', async (msg) => {
    const chatId = msg.chat.id
    const fileId = msg.voice.file_id

    let oggPath: string | undefined, mp3Path: string | undefined, audioPath: string | undefined

    try {
        await bot.sendMessage(chatId, 'Processing your voice message...')

        oggPath = await downloadFile(fileId, chatId)
        console.log("OGG file downloaded:", oggPath)

        mp3Path = await convertToMp3(oggPath, chatId)
        console.log("MP3 file converted:", mp3Path)

        if (!fs.existsSync(mp3Path)) {
            throw new Error('MP3 file was not created successfully')
        }

        const transcribedText = await transcribeAudio(mp3Path)
        console.log("transcribedText>>>>>", transcribedText)

        const response = await fetch(`${process.env['PROD_URL']}/finance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: transcribedText })
        })

        const data = await response.json()
        const botResponse = data.response || 'Sorry, I couldn’t process your request.'

        // Send text response with transcribed text
        await bot.sendMessage(chatId, botResponse)

        // // Generate and send voice response
        // audioPath = await textToSpeech(botResponse, chatId)
        // await bot.sendVoice(chatId, audioPath)
    } catch (error) {
        console.error('Error handling Telegram voice message:', error)
        await bot.sendMessage(chatId, 'An error occurred while processing your voice message: ' + (error as Error).message)
    } finally {
        if (oggPath && fs.existsSync(oggPath)) fs.unlinkSync(oggPath)
        if (mp3Path && fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path)
        if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath)
    }
})

// Start the server
console.log(`Server running at http://localhost:3000`)
export default app