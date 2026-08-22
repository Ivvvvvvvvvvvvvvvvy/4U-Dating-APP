import type { Activity, Person } from '../data';
import { ChevronRightIcon, SparkIcon } from './Icons';

type Props = {
  person: Person;
  activity: Activity;
  onOpen: (person: Person, activity: Activity) => void;
};

export function PersonCard({ person, activity, onOpen }: Props) {
  return (
    <article className="person-card" onClick={() => onOpen(person, activity)} tabIndex={0} role="button" onKeyDown={(event) => event.key === 'Enter' && onOpen(person, activity)}>
      <div className="person-card__photo">
        <img src={person.avatar} alt={person.name} />
        <span className="person-label"><SparkIcon size={14} />可能合拍</span>
      </div>
      <div className="person-card__body">
        <h3>{person.name}<small>{person.age}</small></h3>
        <p>{person.bio}</p>
        <div className="tag-row tag-row--small">{person.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
        <div className="linked-activity">
          <div><span>可以一起去</span><strong>{activity.title}</strong></div>
          <ChevronRightIcon size={17} />
        </div>
      </div>
    </article>
  );
}
