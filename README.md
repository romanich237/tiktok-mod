# TikTok Mod

Бот для продления огонька в TikTok. Управление через Telegram.

## Что умеет

- Автоматический вход через Telegram-бота (QR / телефон / email)
- Парсинг списка чатов и огоньков
- Выбор получателей в Telegram
- Автоотправка эмодзи каждые 6–12 часов
- Уведомления об отправках и ошибках

**База данных:** SQLite-файл `data/tiktok_mod.db` (ничего ставить не нужно).

---

## Требования

| Компонент | Версия |
|-----------|--------|
| ОС | Ubuntu 20.04+ / Debian 11+ |
| Node.js | 18+ |

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
2. Установит xvfb и библиотеки для Chromium
3. Установит npm-зависимости и Playwright
4. Создаст `config.json` (спросит токен бота и Telegram ID)
5. Создаст файл базы `data/tiktok_mod.db` при первом запуске
6. Запустит бота через PM2

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

## Вход в TikTok (`/login`)

Все данные вводятся в Telegram-боте:

1. `/login` — выбор: **QR-код** | **Телефон** | **Email**
2. **QR** — бот пришлёт фото QR-кода, отсканируйте в приложении TikTok
3. **Телефон** — номер, затем SMS-код
4. **Email** — username/email и пароль

Отмена: `/login_cancel`

---

## Автообновление с GitHub

Каждую минуту бот проверяет [romanich237/tiktok-mod](https://github.com/romanich237/tiktok-mod).  
При новом коммите:

> Вышла новая версия проекта, перезапускаю сервер

Затем `git pull`, `npm install` и перезапуск PM2.

**Требования на сервере:**
- Установка через `git clone` (или `./install.sh` — настроит git автоматически)
- В `config.json`: `"updater": { "enabled": true }`
- Установлен `git`

Проверка вручную:
```bash
cd ~/tiktok-mod
git fetch origin main
git status
pm2 logs tiktok-mod
```

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
├── data/tiktok_mod.db
├── src/
├── sql/
├── sessions/
└── logs/
```

---

## Решение проблем

| Проблема | Решение |
|----------|---------|
| Ошибка базы данных | Удалите `data/tiktok_mod.db` и перезапустите бота |
| Браузер не запускается | `sudo npx playwright install-deps chromium` |
| Нет дисплея для `/login` | PM2 использует xvfb-run; иначе скопируйте `sessions/` |
| `SESSION_EXPIRED` | `/login` заново |

---

## Лицензия

MIT
