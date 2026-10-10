import { useId, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

gsap.registerPlugin(MotionPathPlugin)

const FLOW_DESCRIPTION = 'Animation showing food being posted, picked up by a rider and delivered to a charity'
const LOOP_SECONDS = 12
// Flat tangents at both stops keep the rider upright during pickup and handover.
const ROUTE = 'M145 386C202 386 205 415 260 415S326 386 383 386'

export default function HeroFlowAnimation({ duration = LOOP_SECONDS }) {
  const sceneRef = useRef(null)
  const timelineRef = useRef(null)
  const ambientTimelineRef = useRef(null)
  const manuallyPausedRef = useRef(false)
  const visibleRef = useRef(false)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const maskId = useId().replace(/:/g, '') + '-route-mask'

  function syncPlayback() {
    const shouldPause = manuallyPausedRef.current || !visibleRef.current || document.hidden
    timelineRef.current?.paused(shouldPause)
    ambientTimelineRef.current?.paused(shouldPause)
  }

  useLayoutEffect(() => {
    const scene = sceneRef.current
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(preference.matches)
    updatePreference()
    preference.addEventListener('change', updatePreference)

    const context = gsap.context(() => {
      const select = gsap.utils.selector(scene)
      const route = select('#route')[0]
      const reveal = select('#route-reveal')[0]
      const routeLength = reveal.getTotalLength()
      gsap.set('.flow-story', { opacity: 0 })
      gsap.set('#phone-check, #claimed-tag, #picked-tag, #counter-chip', { scale: 0, transformOrigin: '50% 50%' })
      gsap.set(reveal, { strokeDasharray: routeLength, strokeDashoffset: routeLength })
      gsap.set('#rider', { x: -65, y: 386, svgOrigin: '0 0' })
      gsap.set('#bowl', { x: 151, y: 312, svgOrigin: '0 0' })
      gsap.set('#food-box-lid', { svgOrigin: '-17 -14' })

      // All motion belongs to one timeline. The parent fade masks resets at the seam.
      const timeline = gsap.timeline({
        paused: true, repeat: -1, defaults: { ease: 'power3.out' },
        onRepeat: () => {
          gsap.set(select('#story'), { opacity: 0 })
          gsap.set(select('#donor'), { x: -13, y: 8, opacity: 0 })
          gsap.set(select('#charity'), { x: 14, y: 7, opacity: 0 })
          gsap.set(select('#rider'), { x: -65, y: 386, rotation: 0, opacity: 0 })
          gsap.set(select('#rider-body'), { y: 0, rotation: 0 })
          gsap.set(select('#phone-check, #claimed-tag, #picked-tag, #counter-chip'), {
            scale: 0,
            opacity: 0,
          })
          gsap.set(select('#map-pin'), { y: -28, opacity: 0 })
          gsap.set(select('#bowl'), { x: 151, y: 312, scale: 1, opacity: 0 })
          gsap.set(reveal, { strokeDashoffset: routeLength })
          gsap.set(select('#food-box'), { x: 0, y: 0 })
          gsap.set(select('#food-box-lid'), { rotation: 0 })
          gsap.set(select('#counter-zero'), { y: 0, opacity: 1 })
          gsap.set(select('#counter-one'), { y: 12, opacity: 0 })
          gsap.set(select('#sparkle-burst > *'), { x: 0, y: 0, scale: 0.3, opacity: 0 })
        },
      })
      timelineRef.current = timeline
      timeline.timeScale(LOOP_SECONDS / (Number.isFinite(duration) && duration > 0 ? duration : LOOP_SECONDS))

      timeline
        .addLabel('post', 0)
        .fromTo('#story', { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0)
        .fromTo('#donor', { x: -13, y: 8, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 1.1 }, 0)
        .to('#phone-check', { opacity: 1, scale: 1.15, duration: 0.3 }, 0.75)
        .to('#phone-check', { scale: 1, duration: 0.18 }, 1.05)
        .fromTo('#map-pin', { y: -28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75, ease: 'bounce.out' }, 0.95)
        .to('#bowl', { opacity: 1, duration: 0.35 }, 0.8)

        .addLabel('claim', 2)
        .fromTo('#charity', { x: 14, y: 7, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 0.9 }, 2)
        .to('#claimed-tag', { scale: 1.08, opacity: 1, duration: 0.3 }, 2.65)
        .to('#claimed-tag', { scale: 1, duration: 0.2 }, 2.95)
        .to(reveal, { strokeDashoffset: 0, duration: 1.65, ease: 'sine.inOut' }, 2.25)

        .addLabel('pickup', 4)
        .to('#rider', { x: 145, opacity: 1, duration: 1.05 }, 4)
        .to('#rider-body', { rotation: -5, svgOrigin: '0 33', duration: 0.16 }, 4.95)
        .to('#rider-body', { rotation: 0, duration: 0.22, ease: 'sine.inOut' }, 5.11)
        .to('#food-box-lid', { rotation: -65, duration: 0.2 }, 5.1)
        .to('#bowl', {
          motionPath: { path: 'M151 312C151 278 117 287 117 328' },
          scale: 0.6, duration: 0.52, ease: 'sine.inOut',
        }, 5.28)
        .to('#bowl', { opacity: 0, duration: 0.1 }, 5.75)
        .to('#food-box-lid', { rotation: 0, duration: 0.18 }, 5.8)
        .to('#picked-tag', { scale: 1, opacity: 1, duration: 0.35 }, 5.6)

        .addLabel('deliver', 6)
        // Rider origin is the road contact point; coordinates use the SVG viewBox.
        .to('#rider', {
          motionPath: { path: route, autoRotate: true },
          duration: 3, ease: 'sine.inOut',
        }, 6)
        .to('#rider-body', { y: -1.5, duration: 0.15, repeat: 19, yoyo: true, ease: 'sine.inOut' }, 6)
        .to('.flow-wheel', { rotation: 1080, transformOrigin: '50% 50%', duration: 3, ease: 'none' }, 6)

        .addLabel('handover', 9)
        .to('#food-box', { x: 89, y: -2, duration: 0.8, ease: 'sine.inOut' }, 9.15)
        .fromTo('#sparkle-burst > *', { opacity: 0, x: 0, y: 0, scale: 0.3 }, {
          opacity: 1, scale: 1, transformOrigin: '50% 50%',
          x: (i) => [-16, 15, -12, -20, 9, 20][i],
          y: (i) => [-15, -7, 12, 3, -20, 8][i],
          duration: 0.45, stagger: 0.04,
        }, 9.6)
        .to('#sparkle-burst > *', { opacity: 0, duration: 0.45, stagger: 0.04 }, 10.3)

        .addLabel('count', 11)
        .to('#counter-chip', { scale: 1, opacity: 1, duration: 0.25 }, 11)
        .to('#counter-zero', { y: -12, opacity: 0, duration: 0.18 }, 11.16)
        .fromTo('#counter-one', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.18 }, 11.25)
        .to('#story', { opacity: 0, duration: 0.35, ease: 'sine.inOut' }, 11.65)

      const ambientTimeline = gsap.timeline({
        paused: true,
        repeat: -1,
        defaults: { ease: 'sine.inOut' },
      })
        .to('#ambient-circle', { scale: 1.03, transformOrigin: '50% 50%', duration: 6, repeat: 1, yoyo: true }, 0)
        .to('.flow-leaf-left', { rotation: 4, transformOrigin: 'bottom center', duration: 1.5, repeat: 7, yoyo: true }, 0)
        .to('.flow-leaf-right', { rotation: -4, transformOrigin: 'bottom center', duration: 1.4, repeat: 7, yoyo: true }, 0.8)
        .to('.flow-sparkle', { scale: 0.55, opacity: 0.35, transformOrigin: '50% 50%', duration: 0.75, repeat: 15, yoyo: true }, 0)
        .to('#live-dot', { scale: 1.4, opacity: 0.6, transformOrigin: '50% 50%', duration: 0.6, repeat: 19, yoyo: true }, 0)

      if (!window.matchMedia('(max-width: 420px)').matches) {
        ambientTimeline
          .to('#cloud-left', { x: 10, duration: 6, repeat: 1, yoyo: true }, 0)
          .to('#cloud-right', { x: -8, duration: 6, repeat: 1, yoyo: true }, 0)
          .to('.flow-tree', { rotation: 2, transformOrigin: 'bottom center', duration: 3, repeat: 3, yoyo: true }, 0)
      }
      ambientTimelineRef.current = ambientTimeline

      if (preference.matches) {
        timeline.repeat(0).pause(11.5)
        ambientTimeline.pause()
        timelineRef.current = null
        ambientTimelineRef.current = null
      }
    }, scene)

    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting
      syncPlayback()
    }, { threshold: 0.15 })
    observer.observe(scene)
    document.addEventListener('visibilitychange', syncPlayback)
    syncPlayback()

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncPlayback)
      preference.removeEventListener('change', updatePreference)
      timelineRef.current = null
      ambientTimelineRef.current = null
      context.revert()
    }
  }, [duration, reducedMotion])

  function togglePlayback() {
    manuallyPausedRef.current = !manuallyPausedRef.current
    setPaused(manuallyPausedRef.current)
    syncPlayback()
  }

  return (
    <div className={`landing-art${reducedMotion ? ' landing-art--reduced-motion' : ''}`}>
      <svg
        ref={sceneRef}
        className="landing-art-illustration"
        viewBox="0 0 520 520"
        role="img"
        aria-label={FLOW_DESCRIPTION}
      >
        <circle id="ambient-circle" cx="260" cy="260" r="236" fill="#F1F6F1" />
        <circle cx="260" cy="260" r="204" fill="#F7FAF6" />
        <ellipse cx="260" cy="419" rx="186" ry="16" fill="#E3EBE3" />

        <g id="cloud-left" className="flow-secondary">
          <path d="M61 105c0-9 7-16 16-16 3-12 20-14 26-3 13-2 20 12 12 22H69c-5 0-8-1-8-3Z" fill="#fff" opacity=".8" />
        </g>
        <g id="cloud-right" className="flow-secondary">
          <path d="M390 91c0-7 6-13 13-13 3-10 17-12 22-2 11-2 17 10 10 18h-38c-4 0-7-1-7-3Z" fill="#fff" opacity=".75" />
        </g>

        <g className="flow-secondary flow-tree">
          <path d="M46 367h5v33h-5z" fill="#A97954" />
          <circle cx="48" cy="356" r="17" fill="#9EBB9F" />
          <circle cx="38" cy="366" r="10" fill="#B6CBB3" />
        </g>
        <g className="flow-secondary flow-tree">
          <path d="M469 370h5v30h-5z" fill="#A97954" />
          <circle cx="471" cy="359" r="16" fill="#A8C3A5" />
          <circle cx="481" cy="368" r="9" fill="#C0D1BB" />
        </g>

        <g className="flow-leaf-left">
          <path d="M100 197c-13-37 1-66 34-81 10 32-1 59-34 81Z" fill="#78A984" />
          <path d="M103 188c9-20 17-34 29-48" fill="none" stroke="#F1F6F1" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g className="flow-leaf-right">
          <path d="M419 195c15-36 4-66-28-83-12 31-3 59 28 83Z" fill="#A7C49F" />
          <path d="M416 185c-8-20-15-35-26-50" fill="none" stroke="#F7FAF6" strokeWidth="3" strokeLinecap="round" />
        </g>

        <g id="story">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="520" height="520">
            <path id="route-reveal" d={ROUTE} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          </mask>
        </defs>
        <g id="route-layer">
          <path d={ROUTE} fill="none" stroke="#D6E3D8" strokeWidth="22" strokeLinecap="round" />
          <path id="route" d={ROUTE} fill="none" stroke="#2D6A4F" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 10" mask={`url(#${maskId})`} />
        </g>

        <g id="donor" className="flow-story">
          <path d="M39 244 102 196l63 48v126H39z" fill="#fff" stroke="#D7E1D8" strokeWidth="3" strokeLinejoin="round" />
          <path d="M31 247 102 190l71 57-8 9-63-50-63 50z" fill="#2D6A4F" />
          <path d="M55 270h29v35H55z" fill="#EAF1E9" />
          <path d="M59 274h21v27H59z" fill="#C9DCCB" />
          <path d="M116 269h31v101h-31z" fill="#F4F6F2" stroke="#E0E6E0" strokeWidth="2" />
          <path d="M122 278h19v21h-19z" fill="#E3EBE3" />
          <circle cx="138" cy="320" r="2" fill="#A9B8AB" />
          <path d="M71 244h20v16H71z" fill="#D9822B" />
          <path d="M76 249h10v3H76z" fill="#fff" opacity=".9" />
          <path d="M48 331h13v39H48z" fill="#E9F0E8" />
          <path d="M53 337h4v5h-4z" fill="#2D6A4F" />
          <text x="64" y="387" fill="#52665A" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="700">DONOR</text>

          <g id="donor-person">
            <path d="M91 309c0-9 7-16 16-16s16 7 16 16v36H91z" fill="#E7AD78" />
            <circle cx="107" cy="287" r="14" fill="#C9875A" />
            <path d="M94 286c1-14 24-19 28-2-7-2-16-5-28 2Z" fill="#39463E" />
            <path d="M99 289h2m11 0h2" stroke="#3A443C" strokeWidth="2" strokeLinecap="round" />
            <path d="M97 345h11l-2 34H91z" fill="#2D6A4F" />
            <path d="M108 345h10l7 34h-13z" fill="#3E8161" />
            <path d="M96 379h10v5H94zm18 0h10v5h-9z" fill="#39463E" />
            <path d="M96 311c-11 1-17 7-22 16l17 9" fill="none" stroke="#C9875A" strokeWidth="7" strokeLinecap="round" />
            <path d="M117 312c9 2 14 6 21 12" fill="none" stroke="#C9875A" strokeWidth="7" strokeLinecap="round" />
          </g>
          <g id="phone">
            <rect x="63" y="322" width="22" height="34" rx="4" fill="#273A30" />
            <rect x="66" y="326" width="16" height="24" rx="2" fill="#EAF3EA" />
            <circle cx="74" cy="353" r="1.5" fill="#EAF3EA" />
            <g id="phone-check" className="flow-story">
              <circle cx="74" cy="338" r="7" fill="#2D6A4F" />
              <path d="m70.5 338 2.4 2.4 4.8-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
          <g id="map-pin" className="flow-story">
            <path d="M101 155c-12 0-21 9-21 21 0 16 21 36 21 36s21-20 21-36c0-12-9-21-21-21Z" fill="#D9822B" />
            <circle cx="101" cy="176" r="7" fill="#fff" />
            <path d="M83 214h36" stroke="#D9822B" strokeWidth="2" strokeDasharray="3 4" />
          </g>
        </g>

        <g id="charity" className="flow-story">
          <path d="m355 249 64-48 64 48v120H355z" fill="#fff" stroke="#D7E1D8" strokeWidth="3" strokeLinejoin="round" />
          <path d="m346 251 73-56 73 56-8 9-65-49-65 49z" fill="#789C7F" />
          <path d="M373 273h35v26h-35z" fill="#EAF1E9" />
          <path d="M378 278h25v16h-25z" fill="#CADCCD" />
          <path d="M427 272h35v27h-35z" fill="#EAF1E9" />
          <path d="M432 277h25v17h-25z" fill="#CADCCD" />
          <path d="M400 317h37v52h-37z" fill="#EDF2EC" stroke="#DEE6DE" strokeWidth="2" />
          <circle cx="429" cy="345" r="2" fill="#AAB8AB" />
          <path d="M409 227h19v17h-19z" fill="#D9822B" />
          <path d="M414 232h9v3h-9z" fill="#fff" opacity=".9" />
          <text x="384" y="387" fill="#52665A" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="700">CHARITY</text>

          <g id="charity-person">
            <circle cx="452" cy="318" r="13" fill="#B97C57" />
            <path d="M439 315c2-16 23-17 27-2-10-4-16-3-27 2Z" fill="#39463E" />
            <path d="M437 339c0-9 7-15 15-15s15 6 15 15v36h-30z" fill="#D9822B" />
            <path d="M442 374h10v10h-12zm15 0h9l4 10h-11z" fill="#39463E" />
            <path d="M439 342c-7 5-10 12-12 20m30-19 10 13" fill="none" stroke="#B97C57" strokeWidth="6" strokeLinecap="round" />
          </g>
          <g id="claimed-tag" className="flow-story">
            <rect x="376" y="176" width="83" height="25" rx="12.5" fill="#fff" stroke="#D9E4DA" strokeWidth="1.5" />
            <circle cx="390" cy="188.5" r="4" fill="#2D6A4F" />
            <text x="400" y="192" fill="#2D6A4F" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="700">Claimed</text>
          </g>
        </g>

        <g id="rider" className="flow-story">
          <g transform="translate(0 -33)">
            <g id="rider-body">
              <g className="flow-wheel">
                <circle cx="-25" cy="21" r="12" fill="#283B31" />
                <path d="M-25 11v20m-10-10h20" stroke="#D8E2D9" strokeWidth="2" />
              </g>
              <g className="flow-wheel">
                <circle cx="27" cy="21" r="12" fill="#283B31" />
                <path d="M27 11v20M17 21h20" stroke="#D8E2D9" strokeWidth="2" />
              </g>
              <path d="M-36 12Q-27-6-12 4L0 14h19l5-29h9l-2 35H-23Z" fill="#2D6A4F" />
              <path d="M21-16h13M-15-2H5" stroke="#283B31" strokeWidth="5" strokeLinecap="round" />
              <path d="M1-12 10 2 5 15h12" fill="none" stroke="#39463E" strokeWidth="7" strokeLinecap="round" />
              <path d="M-7-31Q1-36 8-29L14-10H-5Z" fill="#D9822B" />
              <path d="m8-27 9 13h10" fill="none" stroke="#C9875A" strokeWidth="6" strokeLinecap="round" />
              <circle cx="0" cy="-42" r="10" fill="#C9875A" />
              <path d="M-11-42a11 11 0 0 1 22-2l-22 4Z" fill="#2D6A4F" />
              <path d="M-36-4h24" stroke="#283B31" strokeWidth="4" strokeLinecap="round" />
              <g transform="translate(-28 -25)">
                <g id="food-box">
                  <rect x="-17" y="-13" width="34" height="27" rx="3" fill="#D9822B" stroke="#B96821" strokeWidth="1.5" />
                  <path d="M-6-1h12M0-7V5" stroke="#FFF3E2" strokeWidth="3" strokeLinecap="round" />
                  <path id="food-box-lid" d="M-19-18h38v6h-38z" fill="#F2B36D" stroke="#B96821" strokeWidth="1.5" />
                </g>
              </g>
            </g>
          </g>
        </g>

        <g id="bowl" className="flow-story">
          <path d="M-17-5h34l-4 15c-2 7-24 7-26 0z" fill="#fff" stroke="#D5DED5" strokeWidth="2" />
          <ellipse cy="-5" rx="17" ry="5" fill="#E4AF5B" />
          <path d="M-11-6c4-3 7-3 11 0s7 3 11 0" fill="none" stroke="#FFF0CE" strokeWidth="2" strokeLinecap="round" />
          <circle cx="-5" cy="-7" r="2" fill="#6D9863" />
          <circle cx="5" cy="-4" r="2" fill="#D9822B" />
        </g>

        <g id="picked-tag" className="flow-story">
          <rect x="175" y="335" width="91" height="25" rx="12.5" fill="#fff" stroke="#D9E4DA" strokeWidth="1.5" />
          <path d="m187 347 3 3 5-6" fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <text x="201" y="351" fill="#2D6A4F" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="700">Picked up</text>
        </g>

        <g id="effects" transform="translate(65 0)">
        <g id="sparkle-burst" fill="none" stroke="#D9822B" strokeWidth="3" strokeLinecap="round">
          <path d="M323 289v14m-7-7h14" />
          <path d="M360 302v10m-5-5h10" />
          <path d="M337 335v10m-5-5h10" />
          <path d="M311 321v8m-4-4h8" />
          <path d="M374 280c-8-6-2-15 4-10 6-5 12 4 4 10l-4 4z" fill="#EE927A" stroke="none" />
          <path d="M383 279v8m-4-4h8" />
        </g>

        </g>

        <g id="counter-chip" className="flow-story">
          <rect x="183" y="132" width="154" height="38" rx="19" fill="#fff" stroke="#D9E4DA" strokeWidth="1.5" />
          <circle cx="202" cy="151" r="5" fill="#2D6A4F" />
          <text id="counter-zero" x="215" y="155" fill="#2D6A4F" fontSize="14" fontFamily="Inter, sans-serif" fontWeight="800">+0</text>
          <text id="counter-one" x="215" y="155" fill="#2D6A4F" fontSize="14" fontFamily="Inter, sans-serif" fontWeight="800">+1</text>
          <text x="239" y="155" fill="#43564A" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="700">meal delivered</text>
        </g>

        </g>

        <g id="live-badge">
          <rect x="373" y="127" width="59" height="23" rx="11.5" fill="#fff" stroke="#D9E4DA" strokeWidth="1.2" />
          <circle id="live-dot" cx="386" cy="138.5" r="4" fill="#2D6A4F" />
          <text x="396" y="142" fill="#2D6A4F" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="800" letterSpacing=".8">LIVE</text>
        </g>

        <g className="flow-sparkle" fill="none" stroke="#D9822B" strokeWidth="3" strokeLinecap="round">
          <path d="M197 215v12m-6-6h12" />
          <path d="M336 207v10m-5-5h10" />
          <path d="M297 364v10m-5-5h10" />
        </g>
      </svg>
      <p className="landing-art-caption">Good food, shared with care.</p>
      {!reducedMotion && (
        <button
          type="button"
          className="landing-art-playback"
          aria-label={paused ? 'Play food rescue animation' : 'Pause food rescue animation'}
          aria-pressed={paused}
          onClick={togglePlayback}
        >
          <span aria-hidden="true">{paused ? '\u25B6' : '\u2161'}</span>
          {paused ? 'Play' : 'Pause'}
        </button>
      )}
    </div>
  )
}
