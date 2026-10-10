import { Link } from 'react-router-dom'
import PublicHeader from '../../components/PublicHeader'
import SiteFooter from '../../components/SiteFooter'
import HeroFlowAnimation from '../../components/HeroFlowAnimation'
import { useImpact } from '../../hooks/useImpact'
import './landing.css'

const STEPS = [
  ['Post a little extra.', 'Tell us what you have, how much, and when it can be collected.', 'M12 4v16m8-8H4'],
  ['Find its next home.', 'A local charity claims your food and arranges the collection.', 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'],
  ['Make the handover.', 'The charity collects your donation within the pickup window.', 'M3 7h18v13H3zM7 7V4h10v3m-8 6h6'],
  ['See the good it does.', 'The charity records the kilograms delivered. Your impact grows.', 'M4 17l5-5 4 3 7-10m-6 0h6v6'],
]
const QUESTIONS = [
  ['Who can donate food?', 'Restaurants, wedding halls, grocers and households can create a donor account and share surplus food. Include clear quantity, storage and pickup details in your listing.'],
  ['How do charities collect donations?', 'Create an NGO account, browse available food and claim a suitable listing. Collect within its pickup window, then update the status to picked up and delivered.'],
  ['Can I keep my name private?', 'Yes. Donors can turn on the anonymity preference. Anonymous donors are excluded from the public Top Donors list.'],
  ['Is there a fee to get involved?', 'DastarKhan does not collect payments. The platform connects people with surplus food to local charities.'],
]

function Hero() {
  return (
    <section id="top" className="landing-hero">
      <div className="landing-hero-inner">
        <div className="landing-copy">
          <div className="landing-kicker">
            <span className="landing-kicker-dot" />
            Live Food Rescue Platform
          </div>
          
          <h1>
            Surplus food from <span>Pakistan’s kitchens</span>, to those in need.
          </h1>
          
          <p>
            DastarKhan connects restaurants, wedding halls, grocers and households with local charities.
            Donors post what's left over, a charity claims it, and every delivery is counted.
          </p>
          
          <div className="landing-hero-actions">
            <Link to="/auth/signup">
              Donate Food
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
            <Link to="/auth/signup?role=ngo">
              Register Charity
            </Link>
          </div>
        </div>

        <HeroFlowAnimation />
      </div>
    </section>
  )
}


function HowItWorks() {
  return <section id="how" className="landing-section landing-how">
    <div className="landing-section-inner">
      <div className="home-section-heading"><div><p className="home-eyebrow">A SIMPLE WAY TO DO GOOD</p><h2>Less food wasted.<br /><span>More people cared for.</span></h2></div><p>From your kitchen to a community. Four small steps turn something extra into something that matters.</p></div>
      <div className="landing-steps">{STEPS.map(([title, copy, icon], i) => <article className="landing-step" key={title}>
        <div className="home-step-top"><span className="home-step-number">0{i + 1}</span><svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg></div>
        <h3>{title}</h3><p>{copy}</p>
      </article>)}</div>
    </div>
  </section>
}

function JoinCommunity() {
  return <section id="roles" className="landing-section home-join">
    <div className="landing-section-inner">
      <div className="home-section-heading"><div><p className="home-eyebrow">THERE IS A PLACE FOR YOU HERE</p><h2>Good starts <span>with us.</span></h2></div><p>A busy kitchen. A neighbourhood charity.<br />Different starting points, one shared purpose.</p></div>
      <div className="home-join-grid">
        <article className="home-join-card home-join-donor"><span className="home-pill">FOR DONORS</span><div className="home-card-art" aria-hidden="true"><svg viewBox="0 0 200 130"><ellipse cx="100" cy="111" rx="77" ry="8" fill="#E8D6BF" /><path d="M40 59h120q-6 51-60 51T40 59" fill="#D9822B" /><ellipse cx="100" cy="58" rx="62" ry="15" fill="#F5CB81" /><path d="m63 53 12 5m17-9 12 8m18-5 12 6" stroke="#fff" strokeWidth="5" strokeLinecap="round" /><path d="M79 34q-12-12 0-25m22 21q-12-12 0-25m22 29q-12-12 0-25" fill="none" stroke="#A99171" strokeWidth="3" strokeLinecap="round" /></svg></div><h3>Your surplus.<br />Someone's next meal.</h3><p>Make room for kindness. Share good food from your restaurant, event, shop or home.</p><Link to="/auth/signup">Start sharing food <span aria-hidden="true">↗</span></Link></article>
        <article className="home-join-card home-join-charity"><span className="home-pill">FOR CHARITIES</span><div className="home-card-art" aria-hidden="true"><svg viewBox="0 0 200 130"><ellipse cx="100" cy="114" rx="76" ry="8" fill="#CDDCC6" /><path d="M48 53h104v60H48z" fill="#fff" /><path d="m37 56 63-43 63 43" fill="none" stroke="#2D6A4F" strokeWidth="10" strokeLinejoin="round" /><path d="M64 66h22v22H64zm51 0h22v22h-22z" fill="#C4D8BC" /><path d="M91 85h21v28H91z" fill="#D9822B" /><path d="M96 49c-16-12-4-23 4-13 8-10 20 1 4 13l-4 3z" fill="#D9822B" /></svg></div><h3>Closer to food.<br />Closer to your community.</h3><p>Find available donations nearby and help good food reach the people you support.</p><Link to="/auth/signup?role=ngo">Join as a charity <span aria-hidden="true">↗</span></Link></article>
      </div>
    </div>
  </section>
}

function Impact() {
  const { stats: liveStats, loading, error } = useImpact()
  const display = (value) => (loading ? '...' : error ? '—' : value)
  const stats = [
    ['Deliveries completed', display(liveStats.delivered)],
    ['Active rescues', display(liveStats.activeRescues)],
    ['Rescues recorded', display(liveStats.rescues)],
  ]
  return (
    <section id="impact" className="landing-section landing-impact">
      <div className="landing-section-inner landing-impact-grid">
        <div>
          <h2 className="landing-impact-kicker">Recorded impact</h2>
          <div className="landing-impact-total">
            {display(liveStats.deliveredKg.toLocaleString())}
            <span>kg</span>
          </div>
          <p className="landing-impact-copy">
            {error ? 'Impact data is temporarily unavailable.' : 'kilograms recorded as delivered across the donation history.'}
          </p>
        </div>
        
        <div className="landing-impact-stats">
          {stats.map(([label, value]) => (
            <dl key={label} className="landing-impact-stat">
              <div>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            </dl>
          ))}
        </div>
      </div>
    </section>
  )
}


function Community() {
  return <section className="landing-section home-community"><div className="landing-section-inner">
    <div className="home-section-heading"><div><p className="home-eyebrow">THE PEOPLE BEHIND THE GOOD</p><h2>A growing circle <span>of care.</span></h2></div><p>Meet the organisations making food rescue possible, one donation at a time.</p></div>
    <div className="home-community-grid">
      <Link to="/registered-ngos"><div className="home-community-symbol" aria-hidden="true">◎</div><div><span>OUR CHARITY NETWORK</span><h3>Registered NGOs</h3><p>Discover the organisations connecting food with communities.</p></div><b aria-hidden="true">↗</b></Link>
      <Link to="/top-donors"><div className="home-community-symbol" aria-hidden="true">♡</div><div><span>GENEROSITY IN ACTION</span><h3>Top Donors</h3><p>Celebrate donors and the deliveries they have made possible.</p></div><b aria-hidden="true">↗</b></Link>
    </div>
  </div></section>
}

function Questions() {
  return <section className="landing-section home-faq"><div className="landing-section-inner home-faq-grid"><div><p className="home-eyebrow">A FEW THINGS TO KNOW</p><h2>A little clarity.<br /><span>A confident start.</span></h2><p>Food rescue should feel simple.<br />Here are some answers to get you going.</p></div><div>{QUESTIONS.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></section>
}

export default function Landing() {
  return <div className="landing-page home-refresh"><PublicHeader /><main><Hero />
    <div className="home-values" aria-label="Our purpose"><span>Made for local communities</span><i aria-hidden="true">✳</i><span>Every donation matters</span><i aria-hidden="true">✳</i><span>Good food deserves a second chance</span></div>
    <HowItWorks /><JoinCommunity /><Impact /><Community /><Questions />
    <section className="home-final-cta"><div><p className="home-eyebrow">LET'S MAKE ROOM FOR GOOD</p><h2>Have a little extra?<br />It could mean everything.</h2><p>Your next act of kindness could start in your kitchen.</p><Link to="/auth/signup">Share your first donation <span aria-hidden="true">↗</span></Link></div><span className="home-cta-flower" aria-hidden="true">✳</span></section>
    </main><SiteFooter /></div>
}
