// Delegation also handles cards freshly drawn on the random page.
function stepGallery(gallery,direction){
 const slides=[...gallery.querySelectorAll('[data-slide]')];if(slides.length<2)return;
 const previous=Math.max(0,slides.findIndex(slide=>!slide.hidden));
 const next=(previous+direction+slides.length)%slides.length;
 slides.forEach((slide,i)=>{slide.hidden=i!==next});
 gallery.querySelector('.gallery-count').textContent=(next+1)+' / '+slides.length;
 const image=slides[next].querySelector('img');if(image)image.loading='eager';
}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-gallery-step]');if(!button)return;
 event.preventDefault();stepGallery(button.closest('[data-gallery]'),Number(button.dataset.galleryStep));
});
document.addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
 const gallery=event.target.closest?.('[data-gallery]');if(!gallery||gallery.querySelectorAll('[data-slide]').length<2)return;
 event.preventDefault();stepGallery(gallery,event.key==='ArrowRight'?1:-1);
});
