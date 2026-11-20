const API = '/api/students';

const form = document.getElementById('student-form');
const idInput = document.getElementById('student-id');
const nameInput = document.getElementById('name');
const majorInput = document.getElementById('major');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const formTitle = document.getElementById('form-title');
const message = document.getElementById('message');
const tbody = document.getElementById('students');
const countEl = document.getElementById('count');
const emptyEl = document.getElementById('empty');
const searchInput = document.getElementById('search');

let students = [];

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `שגיאה (${res.status})`);
  return data;
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = isError ? 'error' : 'success';
  if (!isError) setTimeout(() => (message.textContent = ''), 2500);
}

function render() {
  const q = searchInput.value.trim().toLowerCase();
  const visible = students.filter(
    (s) => s.name.toLowerCase().includes(q) || s.major.toLowerCase().includes(q)
  );

  tbody.replaceChildren(
    ...visible.map((s) => {
      const tr = document.createElement('tr');

      const nameTd = document.createElement('td');
      nameTd.textContent = s.name; // textContent -> safe from XSS
      const majorTd = document.createElement('td');
      majorTd.textContent = s.major;

      const actionsTd = document.createElement('td');
      actionsTd.className = 'row-actions';
      const editBtn = document.createElement('button');
      editBtn.textContent = 'עריכה';
      editBtn.className = 'secondary';
      editBtn.onclick = () => startEdit(s);
      const delBtn = document.createElement('button');
      delBtn.textContent = 'מחיקה';
      delBtn.className = 'danger';
      delBtn.onclick = () => removeStudent(s);
      actionsTd.append(editBtn, delBtn);

      tr.append(nameTd, majorTd, actionsTd);
      return tr;
    })
  );

  countEl.textContent = students.length;
  emptyEl.hidden = students.length > 0;
}

async function loadStudents() {
  try {
    students = await request(API);
    render();
  } catch (err) {
    showMessage(err.message, true);
  }
}

function startEdit(s) {
  idInput.value = s.id;
  nameInput.value = s.name;
  majorInput.value = s.major;
  formTitle.textContent = 'עריכת סטודנט';
  submitBtn.textContent = 'שמירה';
  cancelBtn.hidden = false;
  nameInput.focus();
}

function resetForm() {
  form.reset();
  idInput.value = '';
  formTitle.textContent = 'הוספת סטודנט';
  submitBtn.textContent = 'הוספה';
  cancelBtn.hidden = true;
}

async function removeStudent(s) {
  if (!confirm(`למחוק את ${s.name}?`)) return;
  try {
    await request(`${API}/${s.id}`, { method: 'DELETE' });
    students = students.filter((x) => x.id !== s.id);
    if (idInput.value === String(s.id)) resetForm();
    render();
    showMessage('הסטודנט נמחק');
  } catch (err) {
    showMessage(err.message, true);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = JSON.stringify({ name: nameInput.value.trim(), major: majorInput.value.trim() });
  const id = idInput.value;
  submitBtn.disabled = true;
  try {
    if (id) {
      const updated = await request(`${API}/${id}`, { method: 'PUT', body });
      students = students.map((s) => (String(s.id) === id ? updated : s));
      showMessage('הפרטים עודכנו');
    } else {
      const created = await request(API, { method: 'POST', body });
      students.unshift(created);
      showMessage('הסטודנט נוסף');
    }
    resetForm();
    render();
  } catch (err) {
    showMessage(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

cancelBtn.addEventListener('click', resetForm);
searchInput.addEventListener('input', render);

loadStudents();
