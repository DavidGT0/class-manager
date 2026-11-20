# ניהול הכיתה – Node + PostgreSQL + Vercel

מערכת קטנה לניהול סטודנטים בכיתה (CRUD), עם השדות **שם סטודנט** ו-**מקצוע**.

| שירות | טכנולוגיה | איפה רץ באוויר |
|------|-----------|----------------|
| צד לקוח | HTML / CSS / JavaScript (`public/`) | Vercel (CDN סטטי) |
| צד שרת | Node.js + Express (`lib/app.js`) | Vercel Serverless Function (`api/index.js`) |
| בסיס נתונים | PostgreSQL (SQL) דרך הספרייה `pg` | Neon Serverless Postgres (מחובר דרך Vercel) |

## מבנה הפרויקט

```
api/index.js                נקודת הכניסה של Vercel (כל /api/* מגיע לכאן)
lib/app.js                  אפליקציית Express – כל נתיבי ה-API ושאילתות ה-SQL
lib/db.js                   חיבור ל-PostgreSQL (Pool) ויצירת הטבלה
lib/schema.js               הגדרת הטבלה students
public/                     צד הלקוח
server.js                   הרצה מקומית
scripts/memory-postgres.js  PostgreSQL בזיכרון (PGlite) לפיתוח ולבדיקות
tests/                      בדיקות API
vercel.json                 הפניית /api/* לפונקציה
```

## הטבלה

```sql
CREATE TABLE IF NOT EXISTS students (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(100) NOT NULL CHECK (length(trim(name))  > 0),
  major      VARCHAR(100) NOT NULL CHECK (length(trim(major)) > 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```
הטבלה נוצרת אוטומטית בחיבור הראשון, כך שלא צריך להריץ אותה ידנית.

## ה-API

| פעולה | Method | נתיב | גוף הבקשה | SQL |
|-------|--------|------|-----------|-----|
| כל הסטודנטים | GET | `/api/students` (אפשר `?major=...`) | – | `SELECT` |
| סטודנט אחד | GET | `/api/students/:id` | – | `SELECT ... WHERE id` |
| יצירה | POST | `/api/students` | `{ "name": "...", "major": "..." }` | `INSERT` |
| עדכון | PUT | `/api/students/:id` | `{ "name"?: "...", "major"?: "..." }` | `UPDATE` |
| מחיקה | DELETE | `/api/students/:id` | – | `DELETE` |
| בדיקת תקינות | GET | `/api/health` | – | `SELECT 1` |

כל השאילתות הן פרמטריות (`$1, $2`), ולכן מוגנות מפני SQL Injection.
קודי שגיאה: `400` לנתונים או מזהה לא תקינים, `404` כשהסטודנט לא נמצא, `503` כשאין חיבור לבסיס הנתונים.

## הרצה מקומית

```bash
npm install
npm run dev:memory   # PostgreSQL בזיכרון, לא צריך שום חשבון → http://localhost:3000
npm test             # בדיקות האוטומטיות

# או מול בסיס הנתונים האמיתי ב-Neon:
npx vercel env pull .env   # מוריד את DATABASE_URL מ-Vercel
npm run dev
```

## העלאה לאוויר (GitHub + Vercel + Neon)

1. **GitHub**: יוצרים ריפו ריק ודוחפים אליו את הקוד. קובץ ה-`.env` לא עולה, הוא ב-`.gitignore`.
2. **Vercel**: ‏Add New → Project, מייבאים את הריפו ולוחצים Deploy.
3. **Neon**: בפרויקט ב-Vercel נכנסים ל-Storage → Create Database → Neon (Serverless Postgres) ומחברים לפרויקט. Vercel מוסיף בעצמו את משתנה הסביבה `DATABASE_URL`.
4. **Redeploy**: ב-Deployments, על הפריסה האחרונה, בוחרים ⋯ → Redeploy כדי שהמשתנה החדש ייכנס לתוקף.
5. **בדיקה**: `https://<your-app>.vercel.app/api/health` אמור להחזיר `{"status":"ok","db":"connected"}`.
