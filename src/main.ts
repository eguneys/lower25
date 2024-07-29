import Graphics from './graphics'
import { SceneManager } from './scenes'


function my_app(el: HTMLElement) {

  let g = Graphics.make(320, 180, true)

  el.appendChild(g.canvas)

  SceneManager(g)
}


my_app(document.getElementById('app')!)