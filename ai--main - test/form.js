/* =========================================================
   NEXUS AI — static form handling
   There is no backend here: the form validates locally, shows a
   readable summary, and offers a prefilled mail draft so the
   entry can actually be sent from the visitor's own mail app.
   ========================================================= */

(() => {
  const MAILBOX = 'hello@nexusai.club';

  const cleanLabel = (text) => text.replace(/\*/g, '').replace(/（[^）]*）/g, '').trim();

  const labelFor = (form, field) => {
    if (field.type === 'checkbox' || field.type === 'radio') {
      const group = field.closest('.field');
      const groupLabel = group ? group.querySelector('.field-label') : null;
      if (groupLabel) return cleanLabel(groupLabel.textContent);
    }
    if (!field.id) return field.name;
    const label = form.querySelector(`label[for="${field.id}"]`);
    if (!label) return field.name;
    return cleanLabel(label.textContent);
  };

  const collect = (form) => {
    const grouped = new Map();
    for (const field of form.elements) {
      if (!field.name) continue;
      if (['submit', 'button', 'reset', 'file'].includes(field.type)) continue;
      if ((field.type === 'checkbox' || field.type === 'radio') && !field.checked) continue;

      let value = (field.value || '').trim();
      if (!value) continue;

      if (field.type === 'checkbox' || field.type === 'radio') {
        const chip = field.closest('.chip');
        if (chip) {
          const text = chip.querySelector('span');
          if (text) value = text.textContent.trim();
        }
      }

      const key = labelFor(form, field);
      grouped.set(key, grouped.has(key) ? `${grouped.get(key)}、${value}` : value);
    }
    return grouped;
  };

  const applyUrlContext = () => {
    const params = new URLSearchParams(window.location.search);
    const context = params.get('team') || params.get('event');
    if (!context) return;

    document.querySelectorAll('[data-context]').forEach((node) => {
      node.textContent = context === params.get('team')
        ? `你正在申请加入「${context}」项目组`
        : `你正在报名「${context}」`;
      node.hidden = false;
    });
  };

  applyUrlContext();

  document.querySelectorAll('form[data-form]').forEach((form) => {
    const success = document.getElementById(form.dataset.success || 'form-success');
    const summary = success ? success.querySelector('.summary-body') : null;
    const mail = success ? success.querySelector('[data-success-mail]') : null;
    const subject = form.dataset.subject || 'NEXUS AI 申请';

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (typeof form.reportValidity === 'function' && !form.reportValidity()) {
        return;
      }

      const entries = collect(form);
      const text = [...entries.entries()].map(([key, value]) => `${key}：${value}`).join('\n');

      if (summary) summary.textContent = text;
      if (mail) {
        const body = `${text}\n\n—— 由 NEXUS AI 网站生成`;
        mail.href = `mailto:${MAILBOX}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }

      if (success) {
        success.classList.add('is-visible');
        success.setAttribute('tabindex', '-1');
        success.focus({ preventScroll: true });
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
})();
