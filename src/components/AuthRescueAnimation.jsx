import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'

// A silent eight-second vector short. No media download or autoplay permission.
export default function AuthRescueAnimation() {
  const root = useRef(null)
  const pausedRef = useRef(false)
  const syncRef = useRef(() => {})
  const [paused, setPaused] = useState(false)

  useLayoutEffect(() => {
    const media = gsap.matchMedia()
    let visible = false
    let timeline
    const sync = () => timeline?.paused(pausedRef.current || !visible || document.hidden)
    syncRef.current = sync
    media.add('(prefers-reduced-motion: no-preference)', () => {
      timeline = gsap.timeline({ repeat: -1, paused: true, defaults: { ease: 'power3.out' } })
        .fromTo('.rescue-film-scene', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0)
        .fromTo('.rescue-film-bowl', { x: -114, y: 8, rotation: -7 }, { x: 0, y: -14, rotation: 0, duration: 1.8 }, 0.4)
        .fromTo('.rescue-film-check', { scale: 0, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, duration: 0.45 }, 2.1)
        .to('.rescue-film-bowl', { x: 114, y: 8, rotation: 7, duration: 1.8, ease: 'sine.inOut' }, 3)
        .fromTo('.rescue-film-heart', { y: 12, opacity: 0, scale: 0.5, transformOrigin: '50% 50%' }, { y: -10, opacity: 1, scale: 1, duration: 0.8, stagger: 0.18 }, 4.8)
        .fromTo('.rescue-film-message', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, 5)
        .to('.rescue-film-heart', { y: -22, opacity: 0, duration: 0.6 }, 6.7)
        .to('.rescue-film-scene', { opacity: 0, duration: 0.5 }, 7.5)
      sync()
      return () => { timeline = null }
    }, root)
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() }, { threshold: 0.1 })
    observer.observe(root.current)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      media.revert()
      syncRef.current = () => {}
    }
  }, [])

  return (
    <div className="rescue-film" ref={root}>
      <div className="rescue-film-top"><span><i /> SMALL ACTS. SHARED JOY.</span><span>01 / FOOD RESCUE</span></div>
      <svg viewBox="0 0 480 300" role="img" aria-label="A bowl of food passes from a donor to a neighbour, bringing a little joy">
        <circle cx="240" cy="140" r="112" fill="#E3EDDE" />
        <path d="M45 218Q240 285 435 218" fill="none" stroke="#CADAC8" strokeWidth="2" strokeDasharray="3 8" />
        <g className="rescue-film-scene">
          <g>
            <path d="M43 245v-66q0-35 37-35t37 35v66" fill="#2D6A4F" />
            <circle cx="80" cy="120" r="25" fill="#CC906B" />
            <path d="M54 116q-1-39 41-22l11 24q-30-13-52-2" fill="#263E31" />
            <path d="M97 169l28 25 33-7" fill="none" stroke="#CC906B" strokeWidth="15" strokeLinecap="round" />
            <path d="M75 122h1m14 0h1m-14 12q6 5 12-1" fill="none" stroke="#513D30" strokeWidth="2" strokeLinecap="round" />
            <text x="80" y="272" textAnchor="middle" fill="#41624B" fontSize="12" fontWeight="600">A little to share</text>
          </g>
          <g>
            <path d="M361 245v-66q0-35 37-35t37 35v66" fill="#D9822B" />
            <circle cx="398" cy="120" r="25" fill="#AD7150" />
            <path d="M373 119q-6-38 29-32 25 4 21 33l-13-18q-9 14-37 17" fill="#263E31" />
            <path d="m382 170-30 24-32-7" fill="none" stroke="#AD7150" strokeWidth="15" strokeLinecap="round" />
            <path d="M386 122h1m14 0h1m-14 12q6 5 12-1" fill="none" stroke="#513D30" strokeWidth="2" strokeLinecap="round" />
            <text x="398" y="272" textAnchor="middle" fill="#41624B" fontSize="12" fontWeight="600">A lot to smile about</text>
          </g>
          <g className="rescue-film-bowl">
            <path d="M207 160h66q-5 35-33 35t-33-35" fill="#fff" stroke="#C9D7C7" strokeWidth="2" />
            <ellipse cx="240" cy="159" rx="34" ry="9" fill="#E8B657" />
            <path d="m219 157 10 3m6-7 9 4m6 0 10 3" stroke="#FFF0CE" strokeWidth="3" strokeLinecap="round" />
            <circle cx="231" cy="155" r="3" fill="#719A64" /><circle cx="249" cy="162" r="3" fill="#719A64" />
          </g>
          <g className="rescue-film-check">
            <circle cx="240" cy="91" r="20" fill="#2D6A4F" />
            <path d="m230 91 7 7 14-15" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <path className="rescue-film-heart" d="M315 93c-20-16-3-28 5-17 9-11 25 2 5 18l-5 4z" fill="#D9822B" />
          <path className="rescue-film-heart" d="M352 66c-14-12-2-21 4-13 7-8 18 2 4 13l-4 3z" fill="#8AA77B" />
          <g className="rescue-film-message">
            <rect x="162" y="225" width="156" height="30" rx="15" fill="#fff" />
            <text x="240" y="245" textAnchor="middle" fill="#2D6A4F" fontSize="12" fontWeight="700">Good food. A new beginning.</text>
          </g>
        </g>
      </svg>
      <div className="rescue-film-bottom"><span>One meal can make someone's day.</span>
        <button type="button" aria-label={paused ? 'Play sharing animation' : 'Pause sharing animation'} aria-pressed={paused} onClick={() => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); syncRef.current() }}>{paused ? 'Play' : 'Pause'} <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span></button>
      </div>
    </div>
  )
}
