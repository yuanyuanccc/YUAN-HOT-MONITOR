import { memo } from 'react'
import { motion } from 'motion/react'

type Props = {
  className?: string
}

const paths = [
  'M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875',
  'M-345 -229C-345 -229 -277 176 187 303C651 430 719 835 719 835',
  'M-310 -269C-310 -269 -242 136 222 263C686 390 754 795 754 795',
  'M-275 -309C-275 -309 -207 96 257 223C721 350 789 755 789 755',
  'M-240 -349C-240 -349 -172 56 292 183C756 310 824 715 824 715',
  'M-205 -389C-205 -389 -137 16 327 143C791 270 859 675 859 675',
  'M-170 -429C-170 -429 -102 -24 362 103C826 230 894 635 894 635',
  'M-135 -469C-135 -469 -67 -64 397 63C861 190 929 595 929 595',
  'M-100 -509C-100 -509 -32 -104 432 23C896 150 964 555 964 555',
  'M-65 -549C-65 -549 3 -144 467 -17C931 110 999 515 999 515',
  'M-30 -589C-30 -589 38 -184 502 -57C966 70 1034 475 1034 475',
  'M5 -629C5 -629 73 -224 537 -97C1001 30 1069 435 1069 435'
]

export const AceternityBackgroundBeams = memo(({ className }: Props) => {
  return (
    <div className={`aceternity-beams ${className ?? ''}`}>
      <svg className="aceternity-beams-svg" width="100%" height="100%" viewBox="0 0 696 316" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875M-345 -229C-345 -229 -277 176 187 303C651 430 719 835 719 835M-310 -269C-310 -269 -242 136 222 263C686 390 754 795 754 795M-275 -309C-275 -309 -207 96 257 223C721 350 789 755 789 755M-240 -349C-240 -349 -172 56 292 183C756 310 824 715 824 715M-205 -389C-205 -389 -137 16 327 143C791 270 859 675 859 675M-170 -429C-170 -429 -102 -24 362 103C826 230 894 635 894 635M-135 -469C-135 -469 -67 -64 397 63C861 190 929 595 929 595M-100 -509C-100 -509 -32 -104 432 23C896 150 964 555 964 555M-65 -549C-65 -549 3 -144 467 -17C931 110 999 515 999 515M-30 -589C-30 -589 38 -184 502 -57C966 70 1034 475 1034 475M5 -629C5 -629 73 -224 537 -97C1001 30 1069 435 1069 435"
          stroke="url(#radialBase)"
          strokeOpacity="0.1"
          strokeWidth="0.7"
        />
        {paths.map((path, index) => (
          <motion.path key={index} d={path} stroke={`url(#beamGradient-${index})`} strokeOpacity="0.36" strokeWidth="0.6" />
        ))}
        <defs>
          {paths.map((_, index) => (
            <motion.linearGradient
              id={`beamGradient-${index}`}
              key={index}
              initial={{ x1: '0%', x2: '0%', y1: '0%', y2: '0%' }}
              animate={{ x1: ['0%', '100%'], x2: ['0%', '96%'], y1: ['0%', '100%'], y2: ['0%', '96%'] }}
              transition={{ duration: 11 + index, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY, delay: index * 0.3 }}
            >
              <stop stopColor="#26e9ff" stopOpacity="0" />
              <stop offset="40%" stopColor="#26e9ff" />
              <stop offset="70%" stopColor="#58a6ff" />
              <stop offset="100%" stopColor="#7f74ff" stopOpacity="0" />
            </motion.linearGradient>
          ))}
          <radialGradient id="radialBase" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(352 34) rotate(90) scale(555 1560.62)">
            <stop offset="0.07" stopColor="#b2f7ff" />
            <stop offset="0.42" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  )
})

AceternityBackgroundBeams.displayName = 'AceternityBackgroundBeams'
