import { Link } from 'react-router-dom';
import { PageHeader, SafetyNotice } from '../components/ui';

const PAGES = {
  safety: {
    title: 'Safety tips',
    intro: 'Most exchanges go smoothly. These habits keep them that way.',
    sections: [
      ['Meet in public, bring a friend', 'Hand over items at a busy, well-lit place such as a society gate, school or shop. For large items, tell someone where you are going.'],
      ['Keep conversations on Sahyog', 'In-app chat keeps a record if something goes wrong. Never share OTPs, bank or card details, or passwords — nobody on Sahyog will ask for them.'],
      ['Check before you accept', 'Review the owner’s trust score and reviews, and inspect items (especially medical equipment and electronics) when you collect them.'],
      ['Nothing is for sale here', 'Sahyog is for lending, sharing and donating. Anyone asking for payment, deposits or “shipping fees” should be reported.'],
      ['Emergencies', 'Sahyog is a community coordination platform, not an emergency service. In immediate danger, call 112 or your local emergency number.'],
      ['Report problems', 'Use the Report button on any listing, emergency request, review or profile. Administrators review reports and can remove content or suspend accounts.'],
    ],
  },
  privacy: {
    title: 'Privacy',
    intro: 'We collect the minimum needed to connect neighbours, and we are careful with it.',
    sections: [
      ['What we store', 'Your name, email, optional phone number, an approximate location, your listings, requests, messages, reviews and activity. Passwords are stored only as salted bcrypt hashes.'],
      ['Approximate locations only', 'Coordinates are rounded to roughly 1 km before they are saved. Exact pickup details are shown only to the owner and to requesters whose request is approved.'],
      ['Who can see what', 'Your email is never shown to other members. Your phone number is revealed to the other party only after a request is approved (or if you opt in on an emergency request you created, to accepted helpers).'],
      ['Browser location', 'We use your browser’s location only after you click “Use my location” and grant permission. You can always choose a city or place a pin instead.'],
      ['Your choices', 'You can edit your profile and sign out of all devices from Settings. To request deletion of your data, use the contact page.'],
    ],
  },
  terms: {
    title: 'Terms of use',
    intro: 'A short, plain-language summary of the rules of the community.',
    sections: [
      ['Be honest and kind', 'Describe items accurately, respond promptly, and treat others with respect. Harassment, scams and discrimination lead to suspension.'],
      ['No commercial activity', 'Listings must be free. You may not sell items or charge fees, deposits or shipping through Sahyog.'],
      ['Your responsibility', 'Exchanges are between members. Inspect items before use and do not offer unsafe, illegal or recalled goods. Sahyog does not guarantee any item or member.'],
      ['Moderation', 'Administrators may remove content or suspend accounts that break these rules. You can appeal decisions from Settings.'],
      ['Rewards', 'Points are recognition only, have no cash value, and may be reversed if earned through fraud.'],
    ],
  },
  contact: {
    title: 'Contact',
    intro: 'Questions, feedback, or a safety concern?',
    sections: [
      ['General', 'Email hello@sahyog.example (replace with your support address before launch).'],
      ['Report abuse', 'Use the Report button inside the app so administrators can act quickly.'],
      ['Organizations', 'To discuss partnerships or verification, register an organization account and submit the verification form.'],
    ],
  },
};

export default function Legal({ page }) {
  const p = PAGES[page];
  return (
    <div className="container-page max-w-3xl py-10">
      <PageHeader title={p.title} subtitle={p.intro} />
      {page === 'safety' && <div className="mb-6"><SafetyNotice /></div>}
      <div className="space-y-6">
        {p.sections.map(([h, t]) => (
          <section key={h}><h2 className="font-sans text-lg font-semibold">{h}</h2><p className="mt-1 text-stone-700">{t}</p></section>
        ))}
      </div>
      <p className="mt-10 text-xs text-stone-500">This page is a good-faith summary for a student/demo deployment. Have it reviewed by a legal professional before a public launch. <Link to="/about" className="link">About Sahyog</Link></p>
    </div>
  );
}
