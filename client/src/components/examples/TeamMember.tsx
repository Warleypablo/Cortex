import TeamMember from '../TeamMember';
import avatar from '@assets/generated_images/Marketing_executive_avatar_male_fff2f919.png';

export default function TeamMemberExample() {
  return (
    <TeamMember 
      name="Murilo Carvalho"
      role="Account Manager"
      avatarUrl={avatar}
    />
  );
}