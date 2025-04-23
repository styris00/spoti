if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch(error => console.log('SW registration failed:', error));
}


document.getElementById('myButton').addEventListener('click', function() {
    alert('Bouton cliqué!');
});
