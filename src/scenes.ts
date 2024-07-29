import Content from './content'
import Graphics from "./graphics"
import Play, { Anim } from "./play"
import i from "./input"
import a from './sound'
import { my_loop } from "./time"

export function SceneManager(g: Graphics) {

    let scene: Scene

    const go = (scene_ctor: { new(): Scene }) => {
        scene = new scene_ctor()
        scene._set_data({ g, go })
        scene.init()
    }

    go(MyScene)

    my_loop(() => {
        scene.update()

        g.clear()
        g.fr(0, 0, 320, 180, '#fafafa')
        g.fr(1, 1, 318, 178, '#1f1f1f')
        scene.draw(g)
    })
}

class Scene extends Play {
    up_p = false
    song?: () => void



    get data() {
        return this._data as { g: Graphics, go: (_: { new(): Scene }) => void}
    }

    get g() {
        return this.data.g
    }

    go(_: { new(): Scene }) {
        this.data.go(_)
    }

    update() {

        if (i('m')) {
            if (!this.up_p) {
                this.up_p = true
                if (this.song) {
                    this.song()
                    this.song = undefined
                } else {
                    this.song = a.play('song', true)
                }
            }
        } else {
            this.up_p = false
        }
        super.update()
    }

}

class MyScene extends Scene {

  _init() {

    Content.load().then(() => {
        let _ = this.make(Anim, { name: 'loading', tag: 'audio', duration: 1000 })
        _.x = 320 / 2
        _.y = 180 / 2

        a.generate().then(() => {
            this.go(AudioLoaded)
        })
    })
  }

}

class AudioLoaded extends Scene {

    _init() {

        const init = () => {
            document.removeEventListener('keydown', init)
            this.go(Intro)
        }

        document.addEventListener('keydown', init)

        let _ = this.make(Anim, { name: 'loading', tag: 'input', duration: 1000 })
        _.x = 260
        _.y = 160
    }
}


class Intro extends Scene {

    _init() {
        this.song = a.play('song', true)
    }
}