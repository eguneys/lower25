const Time = {
    dt: 16
}

export function my_loop(cb: () => void) {

  let last_t: number
  const step = (t: number) => {
    Time.dt = Math.max(16, last_t ? t - last_t : 16) / 1000
    last_t = t

    cb()
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}


export default Time