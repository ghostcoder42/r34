import { artistChipLabel } from './artists';

describe('artistChipLabel', () => {
  it('uses the generic Artist prefix for plain names', () => {
    expect(artistChipLabel('Jackerman')).toBe('Artist: Jackerman');
    expect(artistChipLabel('General Butch')).toBe('Artist: General Butch');
  });

  it('promotes known role suffixes to the prefix and strips them', () => {
    expect(artistChipLabel('OpenNSFW (VA)')).toBe('VA: OpenNSFW');
    expect(artistChipLabel('MizzPeachy (VA)')).toBe('VA: MizzPeachy');
    expect(artistChipLabel('HentAudio (Audio)')).toBe('Audio: HentAudio');
    expect(artistChipLabel('Someone (Artist)')).toBe('Artist: Someone');
  });

  it('keeps unknown parentheticals as part of the name', () => {
    // Only VA/Audio/Artist are known roles — anything else stays verbatim so
    // meaningful suffixes aren't silently dropped.
    expect(artistChipLabel('Studio X (official)')).toBe('Artist: Studio X (official)');
  });

  it('handles degenerate inputs without matching', () => {
    expect(artistChipLabel('(VA)')).toBe('Artist: (VA)');
    expect(artistChipLabel('')).toBe('Artist: ');
  });
});
