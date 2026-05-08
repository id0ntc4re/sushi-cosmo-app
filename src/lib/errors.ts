// Перевод ошибок Supabase / сети в понятные русские сообщения

const MAP: { match: RegExp; msg: string }[] = [
  // Auth
  { match: /invalid login credentials/i, msg: "Неверный email или пароль" },
  { match: /email not confirmed/i, msg: "Email не подтверждён. Проверьте почту" },
  { match: /user already registered|already been registered|already exists/i, msg: "Пользователь с таким email уже зарегистрирован" },
  { match: /password should be at least/i, msg: "Пароль должен содержать минимум 6 символов" },
  { match: /password.*(weak|pwned|leaked|compromised)/i, msg: "Этот пароль слишком простой или скомпрометирован. Придумайте другой" },
  { match: /invalid email/i, msg: "Некорректный email" },
  { match: /rate limit|too many requests|over.*rate/i, msg: "Слишком много попыток. Попробуйте через минуту" },
  { match: /jwt expired|invalid token|not authenticated|unauthor/i, msg: "Сессия истекла. Войдите снова" },
  { match: /signup.*disabled|signups not allowed/i, msg: "Регистрация временно отключена" },
  { match: /captcha/i, msg: "Не пройдена проверка captcha" },
  { match: /otp.*(expired|invalid)/i, msg: "Код подтверждения недействителен или истёк" },

  // Postgres / RLS
  { match: /row-level security|violates row-level/i, msg: "Недостаточно прав для этого действия" },
  { match: /duplicate key|unique constraint/i, msg: "Такая запись уже существует" },
  { match: /foreign key|violates foreign/i, msg: "Нельзя выполнить: запись связана с другими данными" },
  { match: /not-null|null value in column/i, msg: "Заполните все обязательные поля" },
  { match: /value too long/i, msg: "Слишком длинное значение в одном из полей" },
  { match: /invalid input syntax/i, msg: "Неверный формат данных" },
  { match: /permission denied/i, msg: "Доступ запрещён" },
  { match: /check constraint/i, msg: "Введённые данные не прошли проверку" },

  // Network
  { match: /failed to fetch|networkerror|network request failed/i, msg: "Нет соединения с сервером. Проверьте интернет" },
  { match: /timeout|timed out/i, msg: "Сервер не отвечает. Попробуйте ещё раз" },
  { match: /aborted/i, msg: "Запрос был отменён" },
  { match: /500|internal server error/i, msg: "Ошибка сервера. Попробуйте позже" },
  { match: /404|not found/i, msg: "Не найдено" },
  { match: /403|forbidden/i, msg: "Доступ запрещён" },
];

export function ruError(err: unknown, fallback = "Что-то пошло не так. Попробуйте ещё раз"): string {
  if (!err) return fallback;
  const raw =
    typeof err === "string"
      ? err
      : (err as any)?.message || (err as any)?.error_description || (err as any)?.error || "";
  if (!raw) return fallback;
  for (const { match, msg } of MAP) if (match.test(raw)) return msg;
  // Если сообщение уже на кириллице — отдадим как есть
  if (/[а-яё]/i.test(raw)) return raw;
  return fallback;
}
