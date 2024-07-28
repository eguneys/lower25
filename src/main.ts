import Sound from './sound'


function app(el: HTMLElement) {

  console.log(el)
  let s = Sound()


  s.generate().then(() => {
    document.addEventListener('keypress', () => {
      s.play('song', true)
    })
  })
}


app(document.getElementById('app')!)