const Time = {
    dt: 16,
    time: 0,
    on_interval(interval: number, offset = 0) {
      let { dt, time } = this

      let last = Math.floor((time - offset - dt) / interval)
      let next = Math.floor((time - offset) / interval)
      return last < next
    }
}

export function my_loop(cb: () => void) {

  let last_t: number
  const step = (t: number) => {
    Time.dt = Math.min(20, Math.max(16, last_t ? t - last_t : 16)) / 1000
    last_t = t
    Time.time += Time.dt

    cb()
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}


export default Time