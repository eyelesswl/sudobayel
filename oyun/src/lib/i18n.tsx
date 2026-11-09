"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const ru = {
  "home.tagline": "Командная игра на скорость",
  "home.create": "Создать комнату",
  "home.join": "Присоединиться к комнате",
  "common.back": "Назад",
  "common.loading": "Загрузка…",
  "field.name": "Ваше имя",
  "field.code": "Код комнаты",
  "form.create": "Создать",
  "form.join": "Присоединиться",
  "room.code": "Код",
  "room.copy": "Скопировать",
  "room.copied": "Скопировано",
  "room.link": "Ссылка",
  "room.chooseTeam": "Выбрать команду",
  "room.yourTeam": "Ваша команда",
  "room.noTeam": "Без команды",
  "room.you": "вы",
  "room.admin": "админ",
  "room.empty": "Пока никого",
  "room.closed": "Комната закрыта",
  "room.kicked": "Вас удалили из комнаты",
  "room.home": "На главную",
  "room.offline": "Переподключение…",
  "game.press": "Нажать!",
  "game.pickFirst": "Сначала выберите команду",
  "game.waitAdmin": "Ждём начала раунда",
  "game.waitPlayers": "Ожидание участников",
  "game.ready": "Раунд идёт — жми!",
  "game.waitNext": "Ждём следующего раунда",
  "game.winner": "Победитель",
  "game.youWon": "Вы нажали первым!",
  "game.tooLate": "Кто-то был быстрее",
  "game.round": "Раунд {n}",
  "admin.panel": "Панель администратора",
  "admin.newRound": "Новый раунд",
  "admin.reset": "Сбросить результат",
  "admin.teams": "Названия команд",
  "admin.kick": "Удалить",
  "admin.kickConfirm": "Удалить участника {name}?",
  "admin.close": "Закрыть комнату",
  "admin.closeConfirm": "Закрыть комнату для всех?",
  "team.red": "Красные",
  "team.blue": "Синие",
  "team.green": "Зелёные",
  "team.yellow": "Жёлтые",
  "err.invalid_name": "Введите имя (до 24 символов)",
  "err.invalid_code": "Код — 6 символов: буквы и цифры",
  "err.room_not_found": "Комната не найдена",
  "err.room_closed": "Комната закрыта",
  "err.room_full": "Комната заполнена",
  "err.name_taken": "Это имя уже занято в комнате",
  "err.not_admin": "Только администратор может это делать",
  "err.unauthorized": "Сессия недействительна. Войдите заново",
  "err.no_team": "Сначала выберите команду",
  "err.team_locked": "Нельзя менять команду во время раунда",
  "err.cannot_kick_admin": "Нельзя удалить администратора",
  "err.player_not_found": "Участник не найден",
  "err.invalid_request": "Некорректный запрос",
  "err.network": "Нет связи с сервером",
  "err.server_error": "Ошибка сервера. Попробуйте ещё раз",
};

export type Key = keyof typeof ru;

const kg: Record<Key, string> = {
  "home.tagline": "Ылдамдыкка командалык оюн",
  "home.create": "Бөлмө түзүү",
  "home.join": "Бөлмөгө кошулуу",
  "common.back": "Артка",
  "common.loading": "Жүктөлүүдө…",
  "field.name": "Атыңыз",
  "field.code": "Бөлмөнүн коду",
  "form.create": "Түзүү",
  "form.join": "Кошулуу",
  "room.code": "Код",
  "room.copy": "Көчүрүү",
  "room.copied": "Көчүрүлдү",
  "room.link": "Шилтеме",
  "room.chooseTeam": "Команда тандоо",
  "room.yourTeam": "Сиздин команда",
  "room.noTeam": "Командасыз",
  "room.you": "сиз",
  "room.admin": "админ",
  "room.empty": "Азырынча эч ким жок",
  "room.closed": "Бөлмө жабылды",
  "room.kicked": "Сизди бөлмөдөн чыгарышты",
  "room.home": "Башкы бетке",
  "room.offline": "Кайра туташуу…",
  "game.press": "Бас!",
  "game.pickFirst": "Адегенде команданы тандаңыз",
  "game.waitAdmin": "Раунддун башталышын күтөбүз",
  "game.waitPlayers": "Катышуучуларды күтүү",
  "game.ready": "Раунд жүрүүдө — бас!",
  "game.waitNext": "Кийинки раундду күтөбүз",
  "game.winner": "Жеңүүчү",
  "game.youWon": "Сиз биринчи бастыңыз!",
  "game.tooLate": "Бирөө тезирээк болду",
  "game.round": "{n}-раунд",
  "admin.panel": "Администратор панели",
  "admin.newRound": "Жаңы раунд",
  "admin.reset": "Жыйынтыкты тазалоо",
  "admin.teams": "Командалардын аттары",
  "admin.kick": "Чыгаруу",
  "admin.kickConfirm": "{name} катышуучусун чыгарасызбы?",
  "admin.close": "Бөлмөнү жабуу",
  "admin.closeConfirm": "Бөлмөнү бардыгы үчүн жабасызбы?",
  "team.red": "Кызылдар",
  "team.blue": "Көктөр",
  "team.green": "Жашылдар",
  "team.yellow": "Сарылар",
  "err.invalid_name": "Атыңызды жазыңыз (24 белгиге чейин)",
  "err.invalid_code": "Код — 6 белги: тамга жана сандар",
  "err.room_not_found": "Бөлмө табылган жок",
  "err.room_closed": "Бөлмө жабылган",
  "err.room_full": "Бөлмө толгон",
  "err.name_taken": "Бул ат бөлмөдө бош эмес",
  "err.not_admin": "Муну администратор гана жасай алат",
  "err.unauthorized": "Сессия жараксыз. Кайра кириңиз",
  "err.no_team": "Адегенде команданы тандаңыз",
  "err.team_locked": "Раунд учурунда команданы алмаштырууга болбойт",
  "err.cannot_kick_admin": "Администраторду чыгарууга болбойт",
  "err.player_not_found": "Катышуучу табылган жок",
  "err.invalid_request": "Туура эмес суроо",
  "err.network": "Сервер менен байланыш жок",
  "err.server_error": "Сервер катасы. Кайра аракет кылыңыз",
};

export type Lang = "ru" | "kg";
type TFn = (key: Key, vars?: Record<string, string | number>) => string;
const DICTS: Record<Lang, Record<Key, string>> = { ru, kg };
const STORAGE = "oyun:lang";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: TFn }>({
  lang: "ru", setLang: () => {}, t: (k) => ru[k],
});
export const useI18n = () => useContext(Ctx);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ru"); // начальный язык — русский

  useEffect(() => {
    try { const s = localStorage.getItem(STORAGE); if (s === "ru" || s === "kg") setLangState(s); } catch { /* ignore */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang === "kg" ? "ky" : "ru"; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE, l); } catch { /* ignore */ }
    const el = document.getElementById("app-root"); // плавная смена языка
    if (el) { el.classList.remove("lang-swap"); void el.offsetWidth; el.classList.add("lang-swap"); }
  }, []);

  const t: TFn = useCallback((key, vars) => {
    let s = DICTS[lang][key] ?? ru[key];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  }, [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

/** Текст ошибки на текущем языке (по коду из API). */
export function errText(t: TFn, e: unknown): string {
  const code = e instanceof Error ? e.message : "server_error";
  const key = `err.${code}`;
  return t((key in ru ? key : "err.server_error") as Key);
}

/** Название команды: своё, заданное админом, или стандартное на текущем языке. */
export function useTeamName() {
  const { t } = useI18n();
  return (team: { color: string; name: string | null }) => team.name ?? t(`team.${team.color}` as Key);
}

export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="fixed right-4 top-4 z-50 flex rounded-full border border-gold/40 bg-black/60 p-0.5 text-xs font-semibold backdrop-blur">
      {(["ru", "kg"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`rounded-full px-3 py-1.5 transition ${lang === l ? "bg-gold text-ink" : "text-cream/70 hover:text-cream"}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
