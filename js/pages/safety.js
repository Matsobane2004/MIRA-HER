// Safety toolkit: the private safety plan
window.pageInit = function () {
  const { qs, toast, timeAgo } = MIRA;
  const form = qs('#plan');
  const fields = ['warningSigns', 'safePlaces', 'trustedPeople', 'codeWord', 'takeWithMe', 'notes'];

  function fill() {
    const plan = Store.getSafetyPlan();
    fields.forEach((f) => { form.elements[f].value = plan[f] || ''; });
    qs('#planUpdated').textContent = plan.updatedAt ? `Last saved ${MIRA.agoLower(plan.updatedAt)}` : 'Not saved yet';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const plan = {};
    fields.forEach((f) => { plan[f] = form.elements[f].value; });
    try {
      Store.saveSafetyPlan(plan);
      fill();
      toast('Your safety plan is saved. Only you can see it.');
    } catch (err) { toast(err.message, 'error'); }
  });

  fill();
  if (location.hash === '#plan') form.scrollIntoView();
};
