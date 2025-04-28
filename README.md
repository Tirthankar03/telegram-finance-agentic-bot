# 💸 Agentic Finance Assistant Bot

An **Agentic AI-powered** Telegram bot that acts as your **personal finance assistant**. Built from scratch using ⚡️Bun, 🧪Hono, and 🧠 AI APIs like Whisper and ElevenLabs, this bot doesn't just talk—it *acts*. It can track your income and expenses, understand your voice, plan savings goals, and even respond back *with voice*, offering a seamless and intelligent experience.

> 🛠️ Built over a weekend from scratch—no no-code tools, no shortcuts, just pure code and curiosity.

---

## 🚀 Demo

Watch the bot in action:  
📽️ [Click to view the demo](https://drive.google.com/file/d/1Tjz2w8yU94yBK5MAH4Jo9M9d_tOuPFwx/view?usp=sharing)
🤖 [Try it out yourself!](https://t.me/cashhelp07_bot)
📊 [Google Sheet used](https://docs.google.com/spreadsheets/d/1ghGxHKYcoVHa3JAEvnU0K9pzTlxciBvYv8-nj-_X8r8/edit?gid=179851451#gid=179851451)
---

## 📦 Features

- ✍️ **Track Income/Expenses**  
  Add or modify income and expense entries, all stored in a connected **Google Sheet**.

- 🧠 **Voice Understanding**  
  Record and send voice messages—automatically transcribed using **Groq's Whisper** and parsed for intent.

- 🔊 **Voice Responses**  
  Replies aren’t just text-based. Bot replies back *with voice*, powered by **ElevenLabs** for that human-like touch.

- 💰 **Savings Goals Planning**  
  Tell the bot your goal (e.g., "I want to save ₹1,00,000 by December"), and it’ll help you break down your plan.

- 📜 **History & Queries**  
  Ask about previous transactions, current balance, or budget breakdown—it's your financial assistant on demand.

- 🧠 **Autonomous Agentic AI Behavior**  
  This isn’t a passive chatbot—it **acts**. From fetching data, modifying records, to managing logic flows autonomously.

---

## 🧰 Tech Stack

| Tech         | Role                                       |
|--------------|--------------------------------------------|
| **Bun**      | Super-fast runtime and package manager     |
| **Hono**     | Ultra-lightweight web framework (API layer)|
| **Groq + Whisper** | Voice transcription (accurate and fast) |
| **ElevenLabs** | Voice generation (natural-sounding replies) |
| **Google Sheets API** | Persistent storage for transactions |
| **Telegram Bot API** | Interface to interact with the user  |

---

## ⚙️ Setup & Installation

> Prerequisites: [Bun](https://bun.sh), Google Cloud credentials, ElevenLabs + Groq API keys, Telegram bot token.

1. **Clone the repo**
   ```bash
   git clone https://github.com/Tirthankar03/telegram-finance-agentic-bot.git
   cd agentic-finance-bot


2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Create `.env` file**
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   GOOGLE_SHEET_ID=your_google_sheet_id
   GOOGLE_SERVICE_ACCOUNT_JSON=your_service_account_json_base64
   ELEVENLABS_API_KEY=your_elevenlabs_api_key
   GROQ_API_KEY=your_groq_api_key
   ```

4. **Run the bot**
   ```bash
   bun run start
   ```

---

## 🧠 How It Works

1. **User sends a message**  
   → Can be text or voice.

2. **Voice is transcribed using Whisper (via Groq)**  
   → Bot extracts intent from plain English.

3. **Agent interprets intent**  
   → e.g., "Add ₹500 income from freelance work"

4. **Updates Google Sheet**  
   → All data persists and syncs.

5. **Generates response**  
   → Bot replies with a voice response from ElevenLabs + text for confirmation.

---

## 🤖 Commands You Can Try

> In text or voice, the bot supports natural language. Here are some examples:

- `"Add ₹500 as income from freelance work"`
- `"Spent ₹250 on groceries yesterday"`
- `"What's my total income this month?"`
- `"How much did I spend last week?"`
- `"Set a savings goal of ₹1,00,000 by December"`
- `"Get my last 5 transactions"`

---

## 📈 Why Agentic?

Unlike traditional bots, **Agentic AI** systems are proactive, autonomous, and goal-oriented. This bot doesn’t just answer—it *acts*. It understands your intent, manipulates data, and gives meaningful feedback. This isn’t a form-filling tool—it’s a true assistant.

---

## 🧪 Learnings

- Hands-on understanding of building end-to-end AI agents
- Leveraging LLMs for voice-based agents without bloated frameworks
- Interfacing cleanly with real-world APIs and handling edge cases
- The importance of building *from scratch* to understand internals

---

## 🧠 Future Ideas

- 📊 Auto-generate budget visualizations
- 📅 Monthly summary reports
- 🔐 Multi-user support with private sheets
- 🧾 OCR on bills/receipts for auto-entry
- 🧭 Goal tracking with nudges

---

## 🤝 Contributing

Got an idea? Open an issue or submit a PR. Contributions are welcome!


## 🙋‍♂️ Author

**Tirthankar** – [@tirthankar03](https://github.com/Tirthankar03)  
Feel free to reach out on Telegram or LinkedIn if you're curious about agentic systems or want to collaborate on similar ideas!
