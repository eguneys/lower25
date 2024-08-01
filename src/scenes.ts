import Content from './content'
import Graphics from "./graphics"
import Play, { Anim } from "./play"
import i from "./input"
import a from './sound'
import Time, { my_loop } from "./time"


const max_dx = 8
const _G = 4
const jump_max_accel_y = 0.8
const fall_max_accel_y = 3
const max_dy = 4 * _G + 2 * fall_max_accel_y * _G
const max_jump_dy = max_dy

function appr(v: number, t: number, by: number) {
    if (v < t) {
        return Math.min(v + by, t)
    } else if (v > t) {
        return Math.max(v - by, t)
    } else {
        return v
    }
}


/*
const h_dist = (x: number, y: number) => Math.sqrt((Math.abs(x * x - y * y)))
const fixed = (x: number) => Math.round(x)
*/

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

// @ts-ignore
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

abstract class HasPosition extends Play {

    _g_scale = 1

    w = 4
    h = 4

    grid!: MapLoader
    dx = 0
    dy = 0
    x = 0
    y = 0
    collide_v = 0
    collide_h = 0

    pre_grounded = this.grounded

    ledge_grab?: number
    knoll_climb?: number

    get facing() {
        return Math.sign(this.dx)
    }

    get ceiling() {
        return this.collide_v < 0
    }

    get grounded() {
        return this.collide_v > 0
    }

    get left_wall() {
        return this.collide_h < 0
    }

    get right_wall() {
        return this.collide_h > 0
    }

    draw(g: Graphics) {
        g.push_xy(Math.floor(this.x), Math.floor(this.y))
        super.draw(g)
        g.pop()
    }

    update() {
        super.update()
        this.pre_grounded = this.grounded
    }
}

type FxData = {
    duration?: number,
    name: string
}

class Fx extends HasPosition {

    _g_scale = 0

    get data() {
        return this._data as FxData
    }

    get duration() {
        return this.data.duration ?? 1
    }

    _init() {
        this.make(Anim, { name: this.data.name })
    }

    _update() {
        if (this.life > this.duration) {
            this.remove()
        }
    }
}

class Player extends HasPosition {
    w = 8
    h = 8

    _double_jump_left = 2
    _up_counter?: number = 0
    _ground_counter?: number

    is_left = false
    is_right = false

    anim!: Anim

    _init() {
        this.anim = this.make(Anim, { name: 'main_char' })
    }

    _update() {

        let is_left = i('ArrowLeft') || i('a')
        let is_right = i('ArrowRight') || i('d')
        let is_up = i('ArrowUp') || i('w')

        this.is_left = is_left
        this.is_right = is_right

        if (is_left) {
            this.dx = -max_dx
        } else if (is_right) {
            this.dx = max_dx
        } else {
            this.dx = 0
        }

        if (is_up) {
            if (this._up_counter !== undefined) {
                this._up_counter += Time.dt
            }
        } else {
            if (this._up_counter === undefined) {

                this._up_counter = 0
            } else if (this._up_counter > 0) {
                this._up_counter = -0.3
            }
        }

        if (this._up_counter !== undefined) {
            if (this._up_counter < 0) {
                this._up_counter += Time.dt
                if (this._up_counter >= 0) {
                    this._up_counter = undefined
                }
            }
        }

        if (this._up_counter !== undefined) {
            if (this._up_counter > 0) {
                if (this._ground_counter !== undefined) {
                    this.dy = -max_jump_dy
                    this._up_counter = undefined
                    this._double_jump_left = 1
                } else if (this._double_jump_left > 0) {
                    this.dy = -max_jump_dy
                    this._up_counter = undefined
                    this._double_jump_left = 0

                    let _ = this.parent!.make(Fx, { name: 'fx_djump', duration: 0.4 })
                    _.x = this.x
                    _.y = this.y + 5
                }
            }
        }


        if (this.grounded) {
            this._ground_counter = 0
        } else {
            if (this.pre_grounded) {
                this._ground_counter = .16
            }
        }

        if (this._ground_counter !== undefined) {
            if (this._ground_counter > 0) {
                this._ground_counter = appr(this._ground_counter, 0, Time.dt)

                if (this._ground_counter === 0) {
                    this._ground_counter = undefined
                }
            }
        }

        if (this.grounded) {
            if (this.dx !== 0) {
                this.anim.play_tag('run')
                this.anim.scale_x = this.facing
            } else {
                this.anim.play_tag('idle')
            }
        } else {
            this.anim.play_tag('jump')
            if (this.facing !== 0) {
               this.anim.scale_x = this.facing
            }
        }
    }

    _post_update() {
    }
}

type XYWH = { x: number, y: number, w: number, h: number }

class MapLoader extends Play {

    tiles!: number[][]
    cam_x: number = 0
    cam_y: number = 0

    cam_zone_x: number = this.cam_x
    cam_zone_y: number = this.cam_y

    get world_width_px() {
        return this.tiles[0].length * 4
    }

    is_solid_xywh(xywh: XYWH, dx: number, dy: number) {
        return !!this.get_solid_xywh(xywh, dx, dy)
    }

    get_solid_xywh(xywh: XYWH, dx: number, dy: number) {
        let { x, y, w, h } = xywh

        return this.is_solid_rect(x - w / 2 + dx, y - h / 2 + dy, w, h)
    }

    is_solid_rect(x: number, y: number, w = 1, h = 1) {

        let grid_width = this.tiles[0].length
        let grid_height = this.tiles.length

        let grid_x = x / 4
        let grid_y = y / 4
        let grid_end_x = (x + w - 1) / 4
        let grid_end_y = (y + h - 1) / 4

        if (grid_x < 0 || grid_end_x >= grid_width || grid_y < 0 || grid_end_y >= grid_height) {
            return true
        }

        for (x = grid_x; x <= grid_end_x; x++) {
            for (y = grid_y; y <= grid_end_y; y++) {
                x = Math.floor(x)
                y = Math.floor(y)
                if (is_solid_n(this.tiles[y][x])) {
                    return [x * 4, y * 4]
                }
            }
        }
        return undefined
    }

    _init() {

        let l = Content.levels[0]

        this.tiles = []
        for (let i = 0; i < l.h; i++) {
            this.tiles[i] = Array(l.w)
        }

        for (let i = 0; i < l.te.length; i++) {
            let { px, src } = l.te[i]

            let x = px[0] / 4
            let y = px[1] / 4

            let i_src = (src[1] / 4) * 20 + (src[0] / 4)

            if (i_src === 399) {
                let p = this.make(Player)
                p.x = px[0]
                p.y = px[1]

            } else {
              this.tiles[y][x] = i_src
            }
        }
    }

    _update() {

        let p = this.one(Player)!

        if (p.ledge_grab === undefined) {
            let down_solid = this.is_solid_xywh(p, 0, 2)
            let r_solid = this.get_solid_xywh(p, 1, 0)
            let l_solid = this.get_solid_xywh(p, -1, 0)

            // ledge grap
            if (!down_solid) {
                if (p.is_right && Array.isArray(r_solid)) {
                    p.ledge_grab = .2
                    p.x = r_solid[0]
                    p.y = r_solid[1]
                } else if (p.is_left && Array.isArray(l_solid)) {
                    p.ledge_grab = -.2
                    p.x = l_solid[0] + 4
                    p.y = l_solid[1]
                }
            }
        } 

        if (!p.ledge_grab && p.knoll_climb === undefined) {
            let r_knoll =  !this.get_solid_xywh(p, 1, -4) ? this.get_solid_xywh(p, 1, 0) : undefined
            let l_knoll =  !this.get_solid_xywh(p, -1, -4) ? this.get_solid_xywh(p, -1, 0) : undefined

            if (p.is_right && Array.isArray(r_knoll)) {
                p.knoll_climb = .16
                p.x = r_knoll[0]
                p.y = r_knoll[1] - 1
            } else if (p.is_left && Array.isArray(l_knoll)) {
                p.knoll_climb = -.16
                p.x = l_knoll[0] + 4
                p.y = l_knoll[1] - 1
            }
        }



        let bodies = this.objects.filter(_ => _ instanceof HasPosition)

        bodies.forEach(body => {

            let s = this.get_solid_xywh(body, 0, 0) as [number, number]

            if (body.ledge_grab !== undefined) {
                body.ledge_grab = appr(body.ledge_grab, 0, Time.dt)


                if (body.ledge_grab === 0) {
                    body.ledge_grab = undefined


                    body.y = s[1] - 4
                    body.dy = 0
                }
                return
            }

            if (body.knoll_climb !== undefined) {
                body.knoll_climb = appr(body.knoll_climb, 0, Time.dt)

                if (body.knoll_climb === 0) {
                    body.knoll_climb = undefined

                    body.y = s[1] - 4
                    body.dy = 0

                }
                return
            }

            let G = _G * body._g_scale
            let decrease_g = 0

            {
                let dy = Math.abs(body.dy)
                let sign = Math.sign(body.dy)


                for (let di = 0; di < dy; di += 1) {
                    let dyy = 1 / 2 * sign * Math.sqrt(Time.dt)
                    if (this.is_solid_xywh(body, 0, dyy)) {
                        body.collide_v = sign
                        body.dy /= 2
                        decrease_g = 0
                        break
                    } else {
                        body.collide_v = 0
                        body.y += dyy;

                        decrease_g = (1 - sign * (di / dy))

                        {
                            let dii = jump_max_accel_y * G * Math.sqrt(decrease_g)
                            let sign = 1

                            body.dy += sign * dii * Time.dt
                        }
                    }
                }
            }

            {

                let dy = fall_max_accel_y * G
                let sign = 1

                for (let di = 0; di < dy; di += 1) {
                    let dyy = 1 / 2 * sign * Math.sqrt(Time.dt)
                    if (this.is_solid_xywh(body, 0, dyy)) {
                        body.collide_v = sign
                        body.dy = 0
                        break
                    } else {
                        body.collide_v = 0
                        body.y += dyy
                    }
                }
            }



            {
                let dx = Math.abs(body.dx)
                let sign = Math.sign(body.dx)
                let h_accel = 1

                for (let di = 0; di < dx; di += 1) {
                    let dxx = 1 / 2 * sign * Math.sqrt(Time.dt) * h_accel
                    if (this.is_solid_xywh(body, dxx, 0)) {
                        body.collide_h = sign
                        body.dx = 0
                        break
                    } else {
                        body.collide_h = 0
                        body.x += dxx
                    }
                }
            }

        })


        if (p) {
            if (this.cam_zone_x < (p.x - 4) - 10) {
                this.cam_zone_x = (p.x - 4) - 10
            }
            if (this.cam_zone_x > (p.x + 4) + 10) {
                this.cam_zone_x = (p.x + 4) + 10
            }
            if (this.cam_zone_y < p.y - 20) {
                this.cam_zone_y = p.y - 20
            }
            if (this.cam_zone_y > p.y + 20) {
                this.cam_zone_y = p.y + 20
            }
        }

        this.cam_x = appr(this.cam_x, this.cam_zone_x - 32, 40 * Time.dt)
        this.cam_y = this.cam_zone_y - 32

        this.cam_x = Math.min(Math.max(0, this.cam_x), this.world_width_px)
    }

    _pre_draw(g: Graphics) {

        g.push_xy(-this.cam_x, -this.cam_y)

        for (let i = 0; i < this.tiles.length; i++) {
            let col = this.tiles[i]
            for (let j = 0; j < col.length; j++) {
                let n = col[j]
                g.tile(n, j * 4, i * 4)
            }
        }
    }

    _draw(g: Graphics) {
        g.pop()
    }
}


const solid_tiles = [0, 1, 2]
const is_solid_n = (n: number) => solid_tiles.includes(n)