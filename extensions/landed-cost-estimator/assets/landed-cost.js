(function () {
  function money(n, cur) {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n); }
    catch (e) { return cur + ' ' + n.toFixed(2); }
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function init(root) {
    if (root.dataset.ready) return;
    root.dataset.ready = '1';
    var variants = [];
    try { variants = JSON.parse(root.querySelector('.dlc-variants').textContent); } catch (e) {}
    var out = root.querySelector('.dlc-result');
    var btn = root.querySelector('.dlc-btn');

    function currentVariant() {
      var id = new URLSearchParams(location.search).get('variant');
      if (!id) {
        var f = document.querySelector('form[action*="/cart/add"] [name="id"]');
        id = (f && f.value) || root.dataset.variant;
      }
      return variants.find(function (v) { return String(v.id) === String(id); }) || variants[0];
    }
    function currentQty() {
      var q = document.querySelector('form[action*="/cart/add"] [name="quantity"]');
      return Math.max(1, parseInt(q && q.value, 10) || 1);
    }

    btn.addEventListener('click', function () {
      var v = currentVariant();
      var country = root.querySelector('.dlc-country').value;
      var city = root.querySelector('.dlc-city').value.trim();
      var postcode = root.querySelector('.dlc-postcode').value.trim();
      if (!city) { out.innerHTML = '<span class="dlc-error">Please enter your city.</span>'; return; }
      var p = new URLSearchParams({
        country: country, city: city, postcode: postcode,
        price: (v.price / 100).toFixed(2), qty: currentQty(),
        grams: v.grams, currency: root.dataset.currency,
        hs: root.dataset.hs, origin: root.dataset.origin, name: root.dataset.name
      });
      btn.disabled = true; out.textContent = 'Calculating…';
      fetch(root.dataset.endpoint + '?' + p.toString(), { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.ok) { out.innerHTML = '<span class="dlc-error">' + esc(d.error || 'Estimate unavailable.') + '</span>'; return; }
          var rows = d.lines.map(function (l) {
            return '<tr><td>' + esc(l.label) + '</td><td>' + money(l.amount, d.currency) + '</td></tr>';
          }).join('');
          out.innerHTML = '<table>' + rows +
            '<tr class="dlc-total"><td>Estimated duties &amp; taxes</td><td>' + money(d.total, d.currency) + '</td></tr></table>' +
            '<div class="dlc-note">' + esc(d.disclaimer) + '</div>';
        })
        .catch(function () { out.innerHTML = '<span class="dlc-error">Estimate unavailable. Please try again.</span>'; })
        .finally(function () { btn.disabled = false; });
    });
  }
  function boot() { document.querySelectorAll('.dlc-root').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('shopify:section:load', boot);
})();
