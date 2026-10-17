import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { PageHeader } from '../components/ui';

const values = [
  { icon: 'leaf', title: 'Reduce waste', text: 'Most of what sits unused in our homes still has years of life. Passing it on is the most sustainable purchase there is.' },
  { icon: 'users', title: 'Strengthen neighbourhoods', text: 'Lending a drill or donating textbooks turns neighbours into a community.' },
  { icon: 'heart', title: 'Reach people faster', text: 'Emergency requests let a community respond in hours, with verified organizations coordinating larger drives.' },
  { icon: 'shield', title: 'Safe by design', text: 'Approximate locations, private contact details until approval, reviews, reports, and admin moderation.' },
];

export default function About() {
  return (
    <div className="container-page max-w-4xl py-10">
      <PageHeader eyebrow="About" title="Cooperation, one exchange at a time" subtitle="Sahyog (सहयोग) is a Hindi word for cooperation. We are a hyperlocal platform that helps people share what they have and find what they need." />

      <div className="grid gap-4 sm:grid-cols-2">
        {values.map((v) => (
          <div key={v.title} className="card p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon name={v.icon} /></span>
            <h2 className="mt-3 font-sans text-lg font-semibold">{v.title}</h2>
            <p className="mt-1 text-sm text-stone-600">{v.text}</p>
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-2xl">Three ways to exchange</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[['BORROW', 'Borrow', 'Use an item for an agreed period and return it. Owners confirm the return; overdue items are flagged.'], ['DONATE', 'Donate', 'A permanent, free transfer. Perfect for textbooks, clothes and furniture you no longer need.'], ['SHARE', 'Share', 'Shared access to something the community can use together — like a society badminton court.']].map(([k, t, d]) => (
            <div key={k} className="card p-5"><h3 className="font-sans text-base font-semibold">{t}</h3><p className="mt-1 text-sm text-stone-600">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl">How trust and points work</h2>
        <p className="mt-2 text-stone-700">Your <strong>trust score</strong> (0–100) is calculated by the server from real activity — you can never edit it. It rises with completed exchanges, reliable fulfilment, positive reviews and (for organizations) admin verification, and falls with confirmed policy violations. The weights are configurable by the platform.</p>
        <p className="mt-3 text-stone-700"><strong>Reward points</strong> recognise verified contributions: completing a donation, lending an item that is returned, sharing a resource, or helping fulfil an emergency request. Each exchange can be rewarded exactly once, daily caps limit abuse, and every credit or reversal is recorded in a ledger. Points are recognition only — they cannot be redeemed for money.</p>
        <p className="mt-3 text-stone-700">If you think a moderation decision about your account or content is wrong, you can appeal it from <Link className="link" to="/settings">Settings</Link>.</p>
      </section>

      <section className="mt-12 rounded-2xl bg-brand-900 p-8 text-center text-white">
        <h2 className="text-2xl !text-white">Ready to help — or be helped?</h2>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link to="/discover" className="btn btn-accent">Find resources</Link>
          <Link to="/register" className="btn border border-white/30 text-white hover:bg-white/10">Create a free account</Link>
        </div>
      </section>
    </div>
  );
}
