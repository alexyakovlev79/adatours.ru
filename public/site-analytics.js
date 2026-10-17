window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-FM6ZVZH2ZX');
      // LeadForm emits this only after an HTTP-successful server response.
      document.addEventListener('adatours:lead-success', function(event) {
        var detail = event.detail || {};
        gtag('event', 'generate_lead', {
          send_to: 'G-FM6ZVZH2ZX',
          form_id: 'lead_request',
          entity_id: detail.entityId || '',
          tour_id: detail.tourId || '',
          language: detail.lang || 'ru'
        });
      });

(function(m,e,t,r,i,k,a){
          m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
          m[i].l=1*new Date();
          for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
          k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
      })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=113586792', 'ym');

      ym(113586792, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
