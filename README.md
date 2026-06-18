# TikTok Mod

Бот для продления огонька в TikTok. Управление через Telegram.

## Что умеет

- Автоматический вход через Telegram-бота (QR / телефон / email)
- Парсинг списка чатов и огоньков
- Выбор получателей в Telegram
- Автоотправка эмодзи каждые 6–12 часов
- Уведомления об отправках и ошибках

**База данных:** локальный MySQL Server на том же сервере.

---

## Требования

| Компонент | Версия |
|-----------|--------|
| ОС | Ubuntu 20.04+ / Debian 11+ |
| Node.js | 18+ |
| MySQL Server | 8.0+ |

---

## Быстрая установка

```bash
git clone https://github.com/romanich237/tiktok-mod.git
cd tiktok-mod
chmod +x install.sh
./install.sh
```

Скрипт автоматически:

1. Проверит Ubuntu/Debian и Node.js
2. Установит MySQL, xvfb и библиотеки для Chromium (через apt)
3. Установит npm-зависимости и Playwright
4. Создаст `config.json` (спросит токен бота и Telegram ID)
5. Создаст базу `tiktok_mod` в локальном MySQL
6. Применит миграции таблиц
7. Запустит бота через PM2

### Флаги установщика

| Флаг | Описание |
|------|----------|
| `--systemd` | Вместо PM2 — systemd-сервис |
| `--yes` | Без вопросов |
| `--token TOKEN` | Токен бота |
| `--user-id ID` | Telegram ID |

```bash
./install.sh --token "123:ABC" --user-id 987654321
```

---

## Установка вручную

### 1. Системные пакеты (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y nodejs npm mysql-server xvfb \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 libasound2
sudo systemctl enable mysql
sudo systemctl start mysql
```

### 2. Проект

```bash
git clone https://github.com/romanich237/tiktok-mod.git
cd tiktok-mod
npm install
npx playwright install chromium
sudo npx playwright install-deps chromium
```

### 3. Конфиг

```bash
cp config.json.example config.json
nano config.json
```

```json
{
  "telegram": {
    "botToken": "ТОКЕН_ОТ_@BotFather",
    "allowedUserIds": [ВАШ_TELEGRAM_ID]
  },
  "mysql": {
    "host": "localhost",
    "port": 3306,
    "user": "tiktok",
    "password": "tiktokpass",
    "database": "tiktok_mod"
  }
}
```

### 4. Запуск

```bash
npm start
```

Или напрямую:

```bash
pm2 start ecosystem.config.js
pm2 save
```

---

## Фоновый запуск

По умолчанию `./install.sh` сам ставит PM2 и запускает бота.

```bash
pm2 logs tiktok-mod
pm2 restart tiktok-mod
pm2 status
```

### systemd (опционально)

```bash
sudo cp deploy/tiktok-mod.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tiktok-mod
sudo systemctl start tiktok-mod
sudo journalctl -u tiktok-mod -f
```

Или при установке: `./install.sh --systemd`

---

## Вход в TikTok (`/login`)

Все данные вводятся в Telegram-боте:

1. `/login` — выбор: **QR-код** | **Телефон** | **Email**
2. **QR** — бот пришлёт фото QR-кода, отсканируйте в приложении TikTok
3. **Телефон** — номер, затем SMS-код
4. **Email** — username/email и пароль

Отмена: `/login_cancel`

---

## Автообновление с GitHub

Каждую минуту проверяется новая версия. При обновлении бот пишет:

> Вышла новую версия проекта, перезапускаю сервер

Затем выполняет `git pull`, `npm install`, миграции и перезапуск.

```json
"updater": {
  "enabled": true,
  "checkIntervalMinutes": 1,
  "repository": "https://github.com/romanich237/tiktok-mod.git",
  "branch": "main"
}
```

Проект должен быть установлен через `git clone` (не ZIP).

---

## Первый запуск

1. `/start` в Telegram
2. `/login` — войти в TikTok
3. `/chats` → «Обновить список» → выбрать чаты
4. Эмодзи отправятся автоматически через 6–12 часов

---

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Главное меню |
| `/login` | Войти в TikTok |
| `/chats` | Чаты и выбор получателей |
| `/streaks` | Огоньки |
| `/status` | Статус |
| `/send_now` | Отправить сейчас |
| `/logs` | История отправок |
| `/settings` | Настройки |

---

## Структура

```text
tiktok-mod/
├── install.sh
├── install.js
├── config.json.example
├── ecosystem.config.js
├── deploy/tiktok-mod.service
├── src/
├── sql/
├── sessions/
└── logs/
```

---

## Решение проблем

| Проблема | Решение |
|----------|---------|
| MySQL недоступен | `sudo systemctl status mysql` |
| Браузер не запускается | `sudo npx playwright install-deps chromium` |
| Нет дисплея для `/login` | PM2 уже использует xvfb-run; иначе скопируйте `sessions/` |
| `SESSION_EXPIRED` | `/login` заново |
| Access denied (MySQL) | Запустите `./install.sh` заново |

---

## Лицензия

MIT
