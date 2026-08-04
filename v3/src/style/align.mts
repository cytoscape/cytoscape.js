export const labelHalign = ( halign: string ): 'left' | 'right' | 'center' => {
  switch( halign ){
    case 'left':
    case 'right-inside':
      return 'left';

    case 'right':
    case 'left-inside':
      return 'right';

    default:
      return 'center';
  }
};

export const labelValign = ( valign: string ): 'top' | 'bottom' | 'center' => {
  switch( valign ){
    case 'top':
    case 'bottom-inside':
      return 'top';

    case 'bottom':
    case 'top-inside':
      return 'bottom';

    default:
      return 'center';
  }
};

export const labelJustification = ( halign: string ): 'left' | 'right' | 'center' => {
  switch( halign ){
    case 'left':
      return 'right';

    case 'right':
      return 'left';

    case 'left-inside':
      return 'left';

    case 'right-inside':
      return 'right';

    default:
      return 'center';
  }
};
