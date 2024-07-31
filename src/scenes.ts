import Content, { LevelInfo } from './content'
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
        g.fr(0, 0, 64, 64, '#1a001a')
        g.fr(1, 1, 62, 62, '#1f0f1f')
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
        _.x = 32
        _.y = 32

        a.generate().then(() => {
           // this.go(AudioLoaded)
           this.go(Intro)
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
        _.x = 30
        _.y = 50
    }
}


class Intro extends Scene {

    _init() {
        //this.song = a.play('song', true)
        this.make(MapLoader)
    }
}


class HasPosition extends Play {

    x: number = 0
    y: number = 0

    draw(g: Graphics) {
        g.push_xy(this.x, this.y)
        super.draw(g)
        g.pop()
    }

}

class Player extends HasPosition {

    _init() {
        this.make(Anim, { name: 'main_char' })
    }
}

class MapLoader extends Play {

    tiles!: number[][]
    cam_x: number = 0
    cam_y: number = 0


    _init() {

        let l = Content.levels[0]

        this.tiles = []
        for (let i = 0; i < l.h; i++) {
            this.tiles[i] = Array(l.w)
        }

        for (let i = 0; i < l.te.length; i++) {
            let { px, src } = l.te[i]

            let x = px[0] / 8
            let y = px[1] / 8

            let i_src = (src[1] / 8) * 10 + (src[0] / 8)

            if (i_src === 99) {
                this.cam_x = px[0] - 32
                this.cam_y = px[1] - 32


                let p = this.make(Player)
                p.x = px[0]
                p.y = px[1]

            } else {
              this.tiles[y][x] = i_src
            }
        }
    }


    _pre_draw(g: Graphics) {

        g.push_xy(-this.cam_x, -this.cam_y)

        for (let i = 0; i < this.tiles.length; i++) {
            let col = this.tiles[i]
            for (let j = 0; j < col.length; j++) {
                let n = col[j]
                g.tile(n, j * 8, i * 8)
            }
        }
    }

    _draw(g: Graphics) {
        g.pop()
    }
}