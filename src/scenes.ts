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

function collide_rect(a: XYWH, b: XYWH) {
    return a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
}

/*
const h_dist = (x: number, y: number) => Math.sqrt((Math.abs(x * x - y * y)))
const fixed = (x: number) => Math.round(x)
*/

export function SceneManager(g: Graphics) {

    let scene: Scene

    const go = (scene_ctor: { new(): Scene }) => {
        if (scene) {
            scene.remove()
        }
        scene = new scene_ctor()
        scene._set_data({ g, go })
        scene.init()
    }

    go(MyScene)

    my_loop(() => {
        scene.update()

        g.clear()
        g.fr(0, 0, 64, 64, 'hsl(20, 5%, 50%)')
        g.fr(1, 1, 62, 62, 'hsl(70, 15%, 30%)')
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


    on_cleanup() {
        console.log('here')
        super.on_cleanup()
        this.song?.()
    }

}

class MyScene extends Scene {

  _init() {

    Content.load().then(() => {
        let _ = this.make(Anim, { name: 'loading', tag: 'audio', duration: 1 })
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

        let _ = this.make(Anim, { name: 'loading', tag: 'input', duration: 1 })
        _.x = 30
        _.y = 50
    }
}


class Intro extends Scene {

    _l!: MapLoader

    ui!: UI

    _init() {
        this.song = a.play('song', true, 0.1)
        this._l = this.make(MapLoader, { level: 1 })
        this.ui = this.make(UI)
    }


    _update() {

        if (this._l.one(PlayerDie)) {
            if (i('r')) {
                this.go(Intro)
            }
        }


        if ((this.ui.one(VictorySign)?.life ?? 0) > 4) {
            this._l.remove()
            this.ui.remove()
            this.ui = this.make(UI)
            this._l = this.make(MapLoader, { level: 2 })
        }
    }
}


class UI extends Play {

    width = 0
    t_width = 0
    t_restart?: number
    restart?: Anim

    bump() {
        if (this.t_width > 0) {
            this.width++
        }
        this.t_width = .9
        a.play('pickup' + Math.floor(Math.random() * 3))
    }

    get done() {
        return this.width === this.max_coins
    }

    _init(){

        let _ = this.make(Anim, { name: 'collect', tag: 'coin' })
        _.x = 3
        _.y = 3
    }
    
    _update() {
        if (this.t_width > 0) {

          this.t_width = appr(this.t_width, 0, Time.dt * 3)
          if (this.t_width < 0.5) {
            this.width++
            this.t_width = 0
          }
        }

        if (this.t_restart && this.t_restart > 0) {
          this.t_restart = appr(this.t_restart, 0, Time.dt * 3)

          if (this.t_restart === 0) {
            this.t_restart = undefined
            let _ = this.make(Anim, { name: 'restart', tag: 'bg', duration: .8 })
            _.x = 32
            _.y = 32
            this.restart = this.make(Anim, { name: 'restart', duration: 5 })
            this.restart.x = 32
            this.restart.y = 32
          }
        }

        if (this.restart) {
            this.restart.y = 32 + Math.sin(this.life * 8) * 4
        }
    }

    max_coins = 0

    _draw(g: Graphics) {
        g.fr(6, 1, this.max_coins, 1, '#f7ffff')

        g.fr(6, 2, this.width, 2, '#b4d800')

        let bump_width = (this.t_width / .9) * 1
        g.fr(6 + this.width, 2, bump_width, 2, '#f59562')
    }
}


class VictorySign extends Play {

    _init() {
        let _ =this.make(Anim, { name: 'victory', duration: 1 })
        _.x = 32
        _.y = 32
    }
}

abstract class HasPosition extends Play {

    get hitbox() {
        return { x: this.x, y: this.y, w: this.w / 2, h: this.h / 2}
    }

    anim!: Anim

    is_solid = true
    _g_scale = 1

    d_accel_y = jump_max_accel_y

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
    name: string,
    tag?: string,
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
        this.anim = this.make(Anim, { name: this.data.name, tag: this.data.tag })
    }

    _update() {
        if (this.life > this.duration) {
            this.remove()
        }
    }
}

class Crash extends Fx {

    _g_scale = .3

    _init() {
        this.anim = this.make(Anim, { name: 'crash' })
    }
}


class Collectible extends HasPosition {

    t_collect?: number

}

class Coin extends Collectible {
    _g_scale = 0
    d_accel_y = jump_max_accel_y * 80

    t_vanish?: number

    _init() {
        this.anim = this.make(Anim, { name: 'collect', tag: 'coin', duration: .8 })
    }

    _update() {

        if (this.t_vanish !== undefined) {
            this.t_vanish = appr(this.t_vanish, 0, Time.dt)

            if (this.t_vanish < 2) {
                if (Time.on_interval(.3)) {
                    if (this.visible) {
                        this.visible = false
                    }
                } else {
                    if (Time.on_interval(.1)) {
                        if (!this.visible) {
                            this.visible = true
                        }
                    }
                }
            }

            if (this.t_vanish === 0) {
                this.remove()
            }
        }

        if (this.t_collect !== undefined) {
            this.t_collect = appr(this.t_collect, 0, Time.dt)

            this.anim.duration = .16

            if (this.t_collect === 0) {
                let _ = this.parent!.make(Fx, { name: 'fx_collect', duration: .3 })
                _.x = this.x
                _.y = this.y

                this.remove()
            }

        } else {
            this.dy = Math.sin(this.life * 3)
        }
    }

}

class CrushOnCollide extends HasPosition {}

class Crawler extends CrushOnCollide {
    w = 8
    h = 8

    _init() {
        this.anim = this.make(Anim, { name: 'crawler' })

        this.dx = 1.2
    }


    _update() {
        this.anim.scale_x = this.facing
    }


}


class Flies extends HasPosition {

    _g_scale = 0

    _init() {
        this.anim = this.make(Anim, { name: 'flies', duration: 1 })
    }
}

class PlayerDie extends HasPosition {

    _g_scale = 0
    is_solid = false

    _init() {
        this.make(Anim, { name: 'main_char', tag: 'die', loop: false })
    }
}

class PlayerVictory extends HasPosition {

    _init() {
        this.make(Anim, { name: 'main_char', tag: 'victory' })
    }
}

class Player extends HasPosition {
    w = 8
    h = 8

    t_knockback = 0

    _shoot_cool = 0

    _double_jump_left = 2
    _up_counter?: number = 0
    _ground_counter?: number

    is_left = false
    is_right = false

    _init() {
        this.anim = this.make(Anim, { name: 'main_char' })
    }

    _update() {

        if (this.t_knockback > 0) {
            this.t_knockback = appr(this.t_knockback, 0, Time.dt)

            return
        }

        let is_shoot = i('x')

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
                    a.play('jump')
                } else if (this._double_jump_left > 0) {
                    this.dy = -max_jump_dy
                    this._up_counter = undefined
                    this._double_jump_left = 0

                    a.play('djump')
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



        if (is_shoot && this._shoot_cool === 0) {
            let _ = this.parent!.pool(Bullet, { dx: this.dx, dy: 10 })
            _.x = this.x
            _.y = this.y
            this.dx *= -6
            this._shoot_cool = .2
        }
        this._shoot_cool = appr(this._shoot_cool, 0, Time.dt)
    }

    _post_update() {
    }
}

class Projectile extends Play {
    w = 4
    h = 4
    x!: number
    y!: number
    dx!: number
    dy!: number

    _update() {
        this.dy = Math.sin(this.life * 8) * Math.sin(this.life * 16) * 20


        if (this.life > 1.5) {
            this.remove()
        }
    }

    draw(g: Graphics) {
        g.push_xy(Math.floor(this.x), Math.floor(this.y))
        super.draw(g)
        g.pop()
    }
}

type BulletData = {
    dx: number,
    dy: number
}
class Bullet extends Projectile {


    get data() {
        return this._data as BulletData
    }

    _init() {
        this.dx = this.data.dx * 2
        this.dy = this.data.dy

        this.make(Anim, { name: 'bullet' })
    }
}

type XYWH = { x: number, y: number, w: number, h: number }

type MapLoaderData = {
    level: number
}

class MapLoader extends Play {

    get data() {
        return this._data as MapLoaderData
    }

    get ui() {
        return this.parent!.one(UI)!
    }

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

        let l = Content.levels[this.data.level - 1]

        this.tiles = []
        for (let i = 0; i < l.h; i++) {
            this.tiles[i] = Array(l.w)
        }

        let nb_coin = 0
        for (let i = 0; i < l.te.length; i++) {
            let { px, src } = l.te[i]

            let x = px[0] / 4
            let y = px[1] / 4

            let i_src = (src[1] / 4) * 20 + (src[0] / 4)

            if (i_src === 399) {
                let p = this.make(Player)
                p.x = px[0]
                p.y = px[1]

                let f = this.make(Flies)
                f.x = px[0]
                f.y = px[1] - 8

            } else if (i_src === 398) {
                let c = this.make(Crawler)
                c.x = px[0]
                c.y = px[1]
            } else if (i_src === 397) {
                let c = this.make(Coin)
                c.x = px[0]
                c.y = px[1]
                nb_coin ++
            } else {
              this.tiles[y][x] = i_src
            }
        }

        this.nb_coin = nb_coin
    }

    nb_coin = 0

    _first_update(): void {
        this.ui.max_coins = this.nb_coin
    }

    _update() {

        let p = this.one(Player)
        

        if (p && this.ui.done) {
            let _ = this.make(PlayerVictory)
            _.x = p.x
            _.y = p.y
            p.remove()

            this.one(Flies)?.remove()


            this.ui.make(VictorySign)
        }

        let crawlers = this.many(Crawler)
        crawlers.forEach(crawl => {
            if (this.is_solid_xywh(crawl, Math.sign(crawl.dx), 0) || 
                !this.is_solid_xywh(crawl, Math.sign(crawl.dx) * 4, 1)) {
                    crawl.dx *= -1
                }
        })


        if (p && p.t_knockback === 0) {


            let collects = this.objects.filter(_ => _ instanceof Collectible)

            collects.forEach(crush => {
                if (crush.t_collect === undefined && collide_rect(crush, p)) {
                    crush.t_collect = .3
                    crush.dy = -8

                    this.ui?.bump()
                }
            })



            let crushes = this.objects.filter(_ => _ instanceof CrushOnCollide)

            crushes.forEach(crush => {
                if (collide_rect(crush.hitbox, p.hitbox)) {

                    if (this.ui.width === 0) {
                        p.remove()
                        let _ = this.make(PlayerDie)
                        _.x = p.x
                        _.y = p.y
                        this.ui.t_restart = 2
                    }


                    p.make(Fx, { name: 'fx_flash' })

                    a.play('damage')
                    p.t_knockback = .6
                    p.dy = -max_jump_dy * 0.8
                    if (p.dx === 0) {
                        p.dx = max_dx * 0.8
                    } else {
                        p.dx = - Math.sign(p.dx) * max_dx * 0.8
                    }
                    for (let i = 0; i< this.ui.width; i++) {
                        let _ = this.make(Coin)
                        _.x = p.x
                        _.y = p.y
                        _.dx = Math.sin((i / this.ui.width) * Math.PI * 2) * 8
                        _.dy = Math.cos((i / this.ui.width) * Math.PI * 2) * 80
                        _.t_vanish = 5
                    }
                    this.ui.width = 0
                }
            })
        }




        if (p && p.ledge_grab === undefined) {
            let down_solid = this.is_solid_xywh(p, 0, 2)
            let r_solid = !this.get_solid_xywh(p, 1, -1) ? this.get_solid_xywh(p, 1, 0) : undefined
            let l_solid = !this.get_solid_xywh(p, -1, -1) ? this.get_solid_xywh(p, -1, 0) : undefined

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

        if (p && !p.ledge_grab && p.knoll_climb === undefined) {
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
                            let dii = body.d_accel_y * G * Math.sqrt(decrease_g)
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

        let pv = this.one(PlayerVictory)
        let fw = p || pv

        if (fw) {
            if (this.cam_zone_x < (fw.x - 4) - 1) {
                this.cam_zone_x = (fw.x - 4) - 1 
            }
            if (this.cam_zone_x > (fw.x + 4) + 1) {
                this.cam_zone_x = (fw.x + 4) + 1
            }
            if (this.cam_zone_y < fw.y - 8) {
                this.cam_zone_y = fw.y - 8
            }
            if (this.cam_zone_y > fw.y + 8) {
                this.cam_zone_y = fw.y + 8
            }
        }

        if (fw) {
            let show_more = fw.dx < 0 ? -50 : fw.dx > 0 ? -10 : -32
            this.cam_x = appr(this.cam_x, this.cam_zone_x + show_more, 50 * Time.dt)
            this.cam_y = this.cam_zone_y - 32

            this.cam_x = Math.min(Math.max(0, this.cam_x), this.world_width_px)
        } 
       
        if (this.one(PlayerDie)) {
            this.cam_x = appr(this.cam_x, this.cam_x + Math.sin(this.life * 9) * 8, Time.dt * 8)
            this.cam_y = appr(this.cam_y, this.cam_y + Math.cos(this.life * 9) * 8, Time.dt * 8)
        }

        let pjs = this.objects.filter(_ => _ instanceof Projectile)


        pjs.forEach(pj => {


            {
                let dy = Math.abs(pj.dy)
                let sign = Math.sign(pj.dy)

                for (let di = 0; di < dy; di += 1) {
                    let dyy = 1 / 2 * sign * Math.sqrt(Time.dt)
                    if (this.is_solid_xywh(pj, 0, dyy)) {
                        pj.dy /= 2
                        break
                    } else {
                        pj.y += dyy;

                        {
                            let dii = 1
                            let sign = 1

                            pj.dy += sign * dii * Time.dt
                        }
                    }
                }
            }

            {
                let dx = Math.abs(pj.dx)
                let sign = Math.sign(pj.dx)
                let h_accel = 1

                for (let di = 0; di < dx; di += 1) {
                    let dxx = 1 / 2 * sign * Math.sqrt(Time.dt) * h_accel
                    if (this.is_solid_xywh(pj, dxx, 0)) {
                        pj.dx = 0
                        let _ = this.pool(Crash)
                        _.x = pj.x - sign * 2
                        _.y = pj.y
                        _.anim.scale_x = sign
                        this.remove(pj)
                        break
                    } else {
                        pj.x += dxx
                    }
                }
            }


        })


        let f = this.one(Flies)


        if (f && p) {
           f.x = appr(f.x, p.x + Math.cos(p.life * 8) * 4, Time.dt * 30)
           f.y = appr(f.y, p.y - 8 + Math.sin(p.life * 8) * 8, Time.dt * 26)


           if (Math.abs(f.x - p.x) + Math.abs(f.y - p.y) <= 16) {
               f.anim.play_tag('idle')
           } else {
               f.anim.play_tag('run')
           }

            f.anim.scale_x = p.anim.scale_x
        }


        let dust = 'none'
        if (p && p.grounded && p.dx !== 0) {
            if (Time.on_interval(0.3 + Math.random() * 0.5)) {

                dust = 'idle'
            }
        }
        if (p && !p?.pre_grounded && p.grounded) {
            dust = 'jump'
        }

        if (p && dust !== 'none') {
                let _ = this.make(Fx, { name: 'fx_dust', tag: dust, duration: .4 })
                _.x = p.x
                if (dust === 'idle') {
                    _.x += - Math.sign(p.dx) * 4
                }
                _.y = p.y
                _.anim.scale_x = Math.max(1, Math.sign(p.dx))
        }



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


const solid_tiles = [0, 1, 2, 3, 4, 5, 20, 21, 22, 23, 24, 40, 41, 42, 44, 60, 61, 62, 63, 64, 80, 81, 82, 83]
const is_solid_n = (n: number) => solid_tiles.includes(n)