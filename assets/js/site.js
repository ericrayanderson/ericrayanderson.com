(function () {
  if (!document.body.classList.contains("play")) return;

  document.addEventListener("touchmove", function (event) {
    if (event.target.closest && event.target.closest("a, .gravity-bar")) return;
    if (event.cancelable) event.preventDefault();
  }, { passive: false });

  document.addEventListener("gesturestart", function (event) {
    event.preventDefault();
  });
})();
