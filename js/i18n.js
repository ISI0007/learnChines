/* 汉学课堂 — i18n engine. Locale registry with fallback to English.
   Spec §26/§31/§32/§94: 20 locales, no hardcoded strings, RTL support. */
(function () {
  'use strict';

  // locale code -> { name, dir, rtl }
  var LOCALES = {
    'en': { name: 'English', dir: 'ltr' },
    'zh-CN': { name: '简体中文', dir: 'ltr' },
    'zh-TW': { name: '繁體中文', dir: 'ltr' },
    'ru': { name: 'Русский', dir: 'ltr' },
    'ur': { name: 'اردو', dir: 'rtl' },
    'ar': { name: 'العربية', dir: 'rtl' },
    'fa': { name: 'فارسی', dir: 'rtl' },
    'hi': { name: 'हिन्दी', dir: 'ltr' },
    'es': { name: 'Español', dir: 'ltr' },
    'fr': { name: 'Français', dir: 'ltr' },
    'de': { name: 'Deutsch', dir: 'ltr' },
    'pt': { name: 'Português', dir: 'ltr' },
    'ja': { name: '日本語', dir: 'ltr' },
    'ko': { name: '한국어', dir: 'ltr' },
    'it': { name: 'Italiano', dir: 'ltr' },
    'tr': { name: 'Türkçe', dir: 'ltr' },
    'id': { name: 'Bahasa Indonesia', dir: 'ltr' },
    'vi': { name: 'Tiếng Việt', dir: 'ltr' },
    'bn': { name: 'বাংলা', dir: 'ltr' },
    'th': { name: 'ไทย', dir: 'ltr' },
  };

  // Translation dictionaries. English is the reference; others override per key.
  var STRINGS = {
    en: {
      'app.name': 'Hanxue Ketang', 'app.nameCn': '汉学课堂',
      'app.tagline': 'Learn Chinese, one lesson at a time.',
      'nav.home': 'Home', 'nav.courses': 'Courses', 'nav.practice': 'Practice',
      'nav.speaking': 'Speaking', 'nav.community': 'Community', 'nav.progress': 'Progress',
      'nav.profile': 'Profile', 'nav.settings': 'Settings', 'nav.admin': 'Admin',
      'nav.vocab': 'Vocabulary', 'nav.library': 'Library', 'nav.exams': 'Exams',
      'search.placeholder': 'Search courses, lessons, vocabulary…',
      'home.hero.title': 'Learn Chinese, starting today.', 'home.hero.sub': 'Master Chinese through structured courses, interactive practice, and offline study tools.',
      'home.startLearning': 'Start Learning', 'home.takeTest': 'Take HSK Test',
      'home.chooseLevel': 'Choose Your HSK Level', 'home.continue': 'Continue Learning',
      'home.daily.title': "Today's Challenge", 'home.daily.word': 'Word of the day',
      'home.daily.cta': 'Learn & Practice', 'home.recommendations': 'Recommended for you',
      'home.teachers': 'Teachers', 'home.viewProfile': 'View profile',
      'level.1': 'Beginner', 'level.2': 'Elementary', 'level.3': 'Intermediate',
      'level.4': 'Upper Intermediate', 'level.5': 'Advanced', 'level.6': 'Proficient',
      'common.words': 'words', 'common.lessons': 'lessons', 'common.minutes': 'min',
      'common.hours': 'h', 'common.vocabulary': 'Vocabulary', 'common.start': 'Start Course',
      'common.continue': 'Continue', 'common.progress': 'Progress', 'common.learnMore': 'Learn more',
      'auth.signIn': 'Sign in', 'auth.createAccount': 'Create account', 'auth.username': 'Username',
      'auth.password': 'Password', 'auth.displayName': 'Display name', 'auth.signOut': 'Sign out',
      'auth.welcomeBack': 'Welcome back', 'auth.sub': 'Sign in to save your progress.',
      'auth.namePlaceholder': 'How should we call you?', 'auth.userPlaceholder': '3–24 letters, numbers, . _ -',
      'auth.passPlaceholder': 'At least 8 characters',
      'msg.comingPhase': 'Planned for {phase}.', 'nav.speaking': 'Speaking',
      'msg.offline': 'Works fully offline — no account or internet required.',
      'progress.xp': 'XP', 'progress.streak': 'day streak', 'progress.wordsKnown': 'Words known',
      'progress.quizzes': 'Quizzes', 'progress.studyDays': 'Study days',
    },
    'zh-CN': {
      'app.tagline': '学中文，从今天开始。',
      'nav.home': '首页', 'nav.courses': '课程', 'nav.practice': '练习',
      'nav.speaking': '口语', 'nav.community': '社区', 'nav.progress': '进度',
      'nav.profile': '个人资料', 'nav.settings': '设置', 'nav.admin': '管理',
      'search.placeholder': '搜索课程、课文、词汇…',
      'home.hero.title': '学中文，从今天开始。', 'home.hero.sub': '通过系统课程与互动练习掌握中文。',
      'home.startLearning': '开始学习', 'home.takeTest': '参加 HSK 测试',
      'home.chooseLevel': '选择你的 HSK 等级', 'home.continue': '继续学习',
      'home.daily.title': '今日挑战', 'home.daily.word': '今日词语', 'home.daily.cta': '学习并练习',
      'home.recommendations': '为你推荐', 'home.teachers': '老师', 'home.viewProfile': '查看主页',
      'level.1': '初级', 'level.2': '基础', 'level.3': '中级', 'level.4': '中高级', 'level.5': '高级', 'level.6': '精通',
      'common.words': '词', 'common.lessons': '课', 'common.start': '开始课程', 'common.continue': '继续',
      'common.progress': '进度', 'auth.signIn': '登录', 'auth.createAccount': '注册',
      'auth.username': '用户名', 'auth.password': '密码', 'auth.displayName': '昵称', 'auth.signOut': '退出登录',
      'auth.welcomeBack': '欢迎回来', 'auth.sub': '登录以保存你的学习进度。',
      'progress.xp': '经验', 'progress.streak': '天连续', 'progress.wordsKnown': '已学词汇',
      'progress.quizzes': '测验', 'progress.studyDays': '学习天数',
    },
    'zh-TW': {
      'app.tagline': '學中文，從今天開始。', 'nav.home': '首頁', 'nav.courses': '課程', 'nav.practice': '練習',
      'nav.speaking': '口說', 'nav.community': '社群', 'nav.progress': '進度', 'nav.settings': '設定',
      'home.startLearning': '開始學習', 'home.chooseLevel': '選擇你的 HSK 等級', 'common.words': '詞',
      'auth.signIn': '登入', 'auth.createAccount': '註冊', 'auth.username': '使用者名稱', 'auth.password': '密碼',
    },
    ru: {
      'app.tagline': 'Учите китайский шаг за шагом.',
      'nav.home': 'Главная', 'nav.courses': 'Курсы', 'nav.practice': 'Практика',
      'nav.speaking': 'Speaking', 'nav.community': 'Сообщество', 'nav.progress': 'Прогресс',
      'nav.settings': 'Настройки', 'search.placeholder': 'Поиск курсов, уроков, слов…',
      'home.hero.title': 'Учите китайский, начиная сегодня.', 'home.hero.sub': 'Освойте китайский с помощью структурированных курсов, практики и ИИ-инструментов.',
      'home.startLearning': 'Начать обучение', 'home.takeTest': 'Пройти тест HSK',
      'home.chooseLevel': 'Выберите уровень HSK', 'home.continue': 'Продолжить обучение',
      'home.daily.title': 'Задание дня', 'home.daily.cta': 'Учить и практиковать', 'home.recommendations': 'Рекомендуем вам',
      'common.words': 'слов', 'common.lessons': 'уроков', 'common.start': 'Начать курс', 'common.continue': 'Продолжить',
      'auth.signIn': 'Войти', 'auth.createAccount': 'Создать аккаунт', 'auth.username': 'Имя пользователя',
      'auth.password': 'Пароль', 'auth.signOut': 'Выйти', 'auth.welcomeBack': 'С возвращением',
      'auth.sub': 'Войдите, чтобы сохранять прогресс.', 'progress.xp': 'Опыт', 'progress.streak': 'дней подряд',
    },
    ur: {
      'app.tagline': 'آج سے چینی سیکھیں۔', 'nav.home': 'ہوم', 'nav.courses': 'کورسز', 'nav.practice': 'مشق',
      'nav.speaking': 'Speaking', 'nav.community': 'کمیونٹی', 'nav.progress': 'پیش رفت', 'nav.settings': 'ترتیبات',
      'home.hero.title': 'آج سے چینی سیکھنا شروع کریں۔', 'home.startLearning': 'سیکھنا شروع کریں',
      'home.chooseLevel': 'اپنی HSK سطح منتخب کریں', 'home.continue': 'سیکھنا جاری رکھیں',
      'common.words': 'الفاظ', 'common.lessons': 'اسباق', 'auth.signIn': 'سائن ان', 'auth.createAccount': 'اکاؤنٹ بنائیں',
      'auth.username': 'صارف نام', 'auth.password': 'پاس ورڈ', 'auth.signOut': 'سائن آؤٹ',
    },
    ar: {
      'app.tagline': 'تعلّم الصينية خطوة بخطوة.', 'nav.home': 'الرئيسية', 'nav.courses': 'الدورات',
      'nav.practice': 'التدريب', 'nav.speaking': 'Speaking', 'nav.community': 'المجتمع', 'nav.progress': 'التقدم',
      'nav.settings': 'الإعدادات', 'home.hero.title': 'تعلّم الصينية، ابدأ اليوم.', 'home.startLearning': 'ابدأ التعلّم',
      'home.chooseLevel': 'اختر مستوى HSK', 'home.continue': 'تابع التعلّم',
      'common.words': 'كلمات', 'common.lessons': 'دروس', 'auth.signIn': 'تسجيل الدخول', 'auth.createAccount': 'إنشاء حساب',
      'auth.username': 'اسم المستخدم', 'auth.password': 'كلمة المرور', 'auth.signOut': 'تسجيل الخروج',
    },
    es: {
      'app.tagline': 'Aprende chino, lección a lección.', 'nav.home': 'Inicio', 'nav.courses': 'Cursos',
      'nav.practice': 'Práctica', 'nav.speaking': 'Speaking', 'nav.community': 'Comunidad', 'nav.progress': 'Progreso',
      'nav.settings': 'Ajustes', 'home.hero.title': 'Aprende chino, empezando hoy.', 'home.startLearning': 'Empezar a aprender',
      'home.chooseLevel': 'Elige tu nivel HSK', 'home.continue': 'Continuar aprendiendo',
      'common.words': 'palabras', 'common.lessons': 'lecciones', 'auth.signIn': 'Iniciar sesión',
      'auth.createAccount': 'Crear cuenta', 'auth.username': 'Usuario', 'auth.password': 'Contraseña', 'auth.signOut': 'Salir',
    },
  };

  var KEY = 'hx_ui_lang';
  var current = 'en';

  function detect() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved && LOCALES[saved]) return saved;
    } catch (e) {}
    var nav = (navigator.language || 'en');
    if (LOCALES[nav]) return nav;
    var base = nav.split('-')[0];
    for (var c in LOCALES) if (c === base || c.split('-')[0] === base) return c;
    return 'en';
  }

  var I18N = {
    locales: LOCALES,
    get lang() { return current; },
    get dir() { return (LOCALES[current] || LOCALES.en).dir; },
    isRTL: function () { return this.dir === 'rtl'; },
    set: function (code) {
      if (!LOCALES[code]) return;
      current = code;
      try { localStorage.setItem(KEY, code); } catch (e) {}
      var dir = LOCALES[code].dir;
      document.documentElement.setAttribute('lang', code);
      document.documentElement.setAttribute('dir', dir);
      document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: code } }));
    },
    t: function (key, vars) {
      var s = (STRINGS[current] && STRINGS[current][key]);
      if (s == null) s = STRINGS.en[key];
      if (s == null) return key;
      if (vars) for (var k in vars) s = s.replace('{' + k + '}', vars[k]);
      return s;
    },
    // List of locales that currently have at least the core strings translated.
    coverage: function (code) { return Object.keys(STRINGS[code] || {}).length; },
  };

  current = detect();
  window.I18N = I18N;
  document.documentElement.setAttribute('lang', current);
  document.documentElement.setAttribute('dir', LOCALES[current].dir);
})();
