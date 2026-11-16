// נוצר אוטומטית ע"י scripts/build_assets.py — אין לערוך ידנית.
export const SPRITES = {
  think_who: require('../assets/sprites/think_who.webp'),
  think_howmuch: require('../assets/sprites/think_howmuch.webp'),
  paid_cash: require('../assets/sprites/paid_cash.webp'),
  closed: require('../assets/sprites/closed.webp'),
  sleeping: require('../assets/sprites/sleeping.webp'),
  new_debt: require('../assets/sprites/new_debt.webp'),
  waiting: require('../assets/sprites/waiting.webp'),
  reminder_sent: require('../assets/sprites/reminder_sent.webp'),
  drinks: require('../assets/sprites/drinks.webp'),
  split_done: require('../assets/sprites/split_done.webp'),
  moneybag: require('../assets/sprites/moneybag.webp'),
  shrug_a: require('../assets/sprites/shrug_a.webp'),
  shrug_b: require('../assets/sprites/shrug_b.webp'),
  cake: require('../assets/sprites/cake.webp'),
  calendar: require('../assets/sprites/calendar.webp'),
  card: require('../assets/sprites/card.webp'),
  binoculars: require('../assets/sprites/binoculars.webp'),
  balanced: require('../assets/sprites/balanced.webp'),
  money_rain: require('../assets/sprites/money_rain.webp'),
  piggy: require('../assets/sprites/piggy.webp'),
  burger: require('../assets/sprites/burger.webp'),
  facepalm: require('../assets/sprites/facepalm.webp'),
  flying_money: require('../assets/sprites/flying_money.webp'),
  receipt: require('../assets/sprites/receipt.webp'),
  gamepad: require('../assets/sprites/gamepad.webp'),
  hoodies: require('../assets/sprites/hoodies.webp'),
  coffee: require('../assets/sprites/coffee.webp'),
  relax: require('../assets/sprites/relax.webp'),
  close_debt: require('../assets/sprites/close_debt.webp'),
  owed_to_me: require('../assets/sprites/owed_to_me.webp'),
  i_owe: require('../assets/sprites/i_owe.webp'),
  friends: require('../assets/sprites/friends.webp'),
  my_products: require('../assets/sprites/my_products.webp'),
  inventory: require('../assets/sprites/inventory.webp'),
  search: require('../assets/sprites/search.webp'),
  summary: require('../assets/sprites/summary.webp'),
  history: require('../assets/sprites/history.webp'),
  backup: require('../assets/sprites/backup.webp'),
  settings: require('../assets/sprites/settings.webp'),
  open_debt: require('../assets/sprites/open_debt.webp'),
  closed_debt: require('../assets/sprites/closed_debt.webp'),
  product: require('../assets/sprites/product.webp'),
  product_list: require('../assets/sprites/product_list.webp'),
  notes: require('../assets/sprites/notes.webp'),
  export_data: require('../assets/sprites/export_data.webp'),
  import_data: require('../assets/sprites/import_data.webp'),
  delete_product: require('../assets/sprites/delete_product.webp'),
  add_friend: require('../assets/sprites/add_friend.webp'),
  transfer_debt: require('../assets/sprites/transfer_debt.webp'),
  add_product: require('../assets/sprites/add_product.webp'),
  remove_product: require('../assets/sprites/remove_product.webp'),
  banner: require('../assets/sprites/banner.webp'),
  hero: require('../assets/sprites/hero.webp'),
};

export const RATIO = {
  think_who: 0.926,
  think_howmuch: 0.932,
  paid_cash: 1.056,
  closed: 1.112,
  sleeping: 1.109,
  new_debt: 1.095,
  waiting: 1.14,
  reminder_sent: 1.133,
  drinks: 1.323,
  split_done: 1.356,
  moneybag: 1.829,
  shrug_a: 1.064,
  shrug_b: 1.114,
  cake: 1.749,
  calendar: 1.16,
  card: 0.855,
  binoculars: 1.268,
  balanced: 1.377,
  money_rain: 1.641,
  piggy: 1.456,
  burger: 1.39,
  facepalm: 1.346,
  flying_money: 1.675,
  receipt: 1.412,
  gamepad: 1.916,
  hoodies: 1.788,
  coffee: 1.592,
  relax: 2.058,
  close_debt: 1.116,
  owed_to_me: 1.104,
  i_owe: 1.104,
  friends: 1.098,
  my_products: 1.092,
  inventory: 1.116,
  search: 1.52,
  summary: 1.504,
  history: 1.496,
  backup: 1.488,
  settings: 1.52,
  open_debt: 1.313,
  closed_debt: 1.299,
  product: 1.299,
  product_list: 1.293,
  notes: 1.286,
  export_data: 1.313,
  import_data: 1.278,
  delete_product: 1.265,
  add_friend: 1.265,
  transfer_debt: 1.258,
  add_product: 1.252,
  remove_product: 1.278,
  banner: 2.319,
  hero: 1.0,
};

// הגלריה לבחירה בהודעות (cat: debt | money | mood | product)
export const STICKERS = [
  {
    "key": "think_who",
    "label": "מי חייב למי?",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "think_howmuch",
    "label": "כמה אני חייב?",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "paid_cash",
    "label": "שילמתי!",
    "cat": "money",
    "gallery": true
  },
  {
    "key": "closed",
    "label": "החוב נסגר!",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "sleeping",
    "label": "נרדם בינתיים",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "new_debt",
    "label": "חוב חדש",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "waiting",
    "label": "ממתין לתשלום",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "reminder_sent",
    "label": "שלחתי תזכורת",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "drinks",
    "label": "חלוקת הוצאה",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "split_done",
    "label": "חילקנו",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "moneybag",
    "label": "עשירים",
    "cat": "money",
    "gallery": true
  },
  {
    "key": "shrug_a",
    "label": "עדיין חייב",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "shrug_b",
    "label": "לא ברור",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "cake",
    "label": "יום תשלום",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "calendar",
    "label": "תזכורת לתשלום",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "card",
    "label": "משלם עכשיו",
    "cat": "money",
    "gallery": true
  },
  {
    "key": "binoculars",
    "label": "איפה הכסף?",
    "cat": "money",
    "gallery": true
  },
  {
    "key": "balanced",
    "label": "מאזן מאוזן",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "money_rain",
    "label": "קיבלתי תשלום!",
    "cat": "money",
    "gallery": true
  },
  {
    "key": "piggy",
    "label": "חוסכים לפעם הבאה",
    "cat": "money",
    "gallery": true
  },
  {
    "key": "burger",
    "label": "זמן לאכול",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "facepalm",
    "label": "שכחתי…",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "flying_money",
    "label": "הכסף עף",
    "cat": "money",
    "gallery": true
  },
  {
    "key": "receipt",
    "label": "בוא נסדר את זה",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "gamepad",
    "label": "המשחק מתחיל",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "hoodies",
    "label": "מעדכנים חוב",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "coffee",
    "label": "שוב חוב על קפה",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "relax",
    "label": "הכול בסדר",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "close_debt",
    "label": "סגירת חוב",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "owed_to_me",
    "label": "חייב לי",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "i_owe",
    "label": "אני חייב",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "friends",
    "label": "חברים",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "my_products",
    "label": "המוצרים שלי",
    "cat": "product",
    "gallery": true
  },
  {
    "key": "inventory",
    "label": "מלאי",
    "cat": "product",
    "gallery": true
  },
  {
    "key": "search",
    "label": "מחפשים",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "summary",
    "label": "סיכום",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "history",
    "label": "היסטוריה",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "open_debt",
    "label": "חוב פתוח",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "closed_debt",
    "label": "חוב סגור",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "product",
    "label": "מוצר",
    "cat": "product",
    "gallery": true
  },
  {
    "key": "product_list",
    "label": "רשימת מוצרים",
    "cat": "product",
    "gallery": true
  },
  {
    "key": "notes",
    "label": "הערות",
    "cat": "mood",
    "gallery": true
  },
  {
    "key": "transfer_debt",
    "label": "העברת חוב",
    "cat": "debt",
    "gallery": true
  },
  {
    "key": "add_product",
    "label": "הוספת מוצר",
    "cat": "product",
    "gallery": true
  },
  {
    "key": "remove_product",
    "label": "הסרת מוצר",
    "cat": "product",
    "gallery": true
  }
];
