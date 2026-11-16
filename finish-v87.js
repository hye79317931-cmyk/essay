'use strict';

/* Essay v87 — save-and-finish only patch for e86 stable rollback.
   This file deliberately does not touch handwriting, zoom, score-edit or layout code.
*/
(function essaySaveAndFinishV87(){
  if (window.__essaySaveAndFinishV87) return;
  window.__essaySaveAndFinishV87 = true;

  let busy = false;

  const cloneV87 = value => {
    try { return structuredClone(value); } catch {}
    try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
  };
  const elV87 = id => document.getElementById(id);
  const valueV87 = id => elV87(id)?.value;
  const numberV87 = id => {
    const value = valueV87(id);
    return value === '' || value == null ? null : Number(value);
  };

  async function saveCurrentAttemptV87(){
    const problem = typeof currentProblem === 'function' ? currentProblem() : null;
    if (!problem || !state?.solve) throw new Error('현재 풀이 정보 없음');

    // Commit the page that is currently visible before building the attempt row.
    try {
      if (typeof saveCurrentAnswerPageV10 === 'function') saveCurrentAnswerPageV10();
    } catch (err) {
      console.warn('v87 answer page commit failed', err);
    }

    try {
      if (typeof elapsedNow === 'function') state.solve.elapsedBase = elapsedNow();
    } catch {}

    if (Array.isArray(state.solve.answerPages) && state.solve.answerPages.length) {
      state.solve.answer = state.solve.answerPages
        .map((page, index) => `[${index + 1}쪽]\n${page?.text || ''}`)
        .join('\n\n');
    }

    const attempt = {
      id: uuid(),
      problemId: problem.id,
      subject: problem.subject,
      session: problem.session,
      mode: state.solve.mode,
      answer: state.solve.answer || '',
      elapsedMs: Number(state.solve.elapsedBase || 0),
      score: numberV87('attemptScoreInput'),
      maxScore: problem.maxScore || 0,
      difficulty: valueV87('difficultyResultInput') || '중',
      needReview: valueV87('needReviewInput') || 'true',
      completion: valueV87('completionInput') || (state.solve.mode === 'outline' ? '목차만' : '완성'),
      memo: (valueV87('memoInput') || '').trim(),
      checkedPoints: Array.from(document.querySelectorAll('#pointChecklist input')).map(x => !!x.checked),
      completedAt: nowIso(),
      answerInkData: state.solve.answerInkData || '',
      answerInkStrokes: cloneV87(state.solve.answerInkStrokes || state.answerInkStrokes || []),
      answerInputMode: state.solve.answerInputMode || state.answerInputMode || 'handwriting',
      answerPages: cloneV87(state.solve.answerPages || [])
    };

    // Only wait for the local IndexedDB write. Firebase push wrappers schedule separately.
    await put(STORE_ATTEMPTS, attempt);

    // Keep the in-memory list current without running the expensive full loadData() chain.
    if (!Array.isArray(state.attempts)) state.attempts = [];
    state.attempts.unshift(attempt);
    state.attempts.sort((a, b) => String(b?.completedAt || '').localeCompare(String(a?.completedAt || '')));

    // Preserve e78's manual-unseen behavior without blocking screen close.
    if (problem.manualUnseenV78 === true) {
      problem.manualUnseenV78 = false;
      Promise.resolve(put(STORE_PROBLEMS, problem)).catch(err => console.warn('v87 unseen reset failed', err));
    }

    return attempt;
  }

  async function finishV87(button){
    if (busy) return;
    busy = true;

    const oldText = button?.textContent || '저장 후 끝내기';
    if (button) {
      button.disabled = true;
      button.textContent = '저장 중...';
    }

    try {
      await saveCurrentAttemptV87();

      try { safeRemoveDraftV72(); }
      catch (err) { console.warn('v87 draft clear failed', err); }

      try { clearInterval(state.timer); } catch {}
      state.timer = null;
      state.solve = null;

      elV87('solveOverlay')?.classList.add('hidden');
      elV87('scoreOverlay')?.classList.add('hidden');

      try { toast('풀이 기록 저장 후 종료 완료'); } catch {}

      // Rendering is deliberately after the overlay is already closed.
      requestAnimationFrame(() => {
        try { renderAll(); }
        catch (err) { console.warn('v87 post-finish render failed', err); }
      });
    } catch (err) {
      console.error('v87 save and finish failed', err);
      try { toast('기록 저장 실패 · 화면은 유지했어'); } catch {}
    } finally {
      busy = false;
      if (button && document.body.contains(button)) {
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  }

  // Capture phase: this runs before e86's old bubble handler
  // `await saveAttempt(); finishSolve(true)` and prevents that legacy path from firing.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#finishBtn');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    finishV87(button);
  }, true);

  window.essaySaveAndFinishV87 = finishV87;
})();
